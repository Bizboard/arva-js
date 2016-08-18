/* */

import hash from './HashSum.js';
import {
    annotate,
    readAnnotations,
    hasAnnotation,
    Provide as ProvideAnnotation,
    TransientScope as TransientScopeAnnotation
} from './Decorators.js';
import {isFunction, toString} from './Util.js';
import {createProviderFromFnOrClass} from './Providers.js';


function constructResolvingMessage(resolving, token) {
    // If a token is passed in, add it into the resolving array.
    // We need to check arguments.length because it can be null/undefined.
    if (arguments.length > 1) {
        resolving.push(token);
    }

    if (resolving.length > 1) {
        return ` (${resolving.map(toString).join(' -> ')})`;
    }

    return '';
}


// Injector encapsulate a life scope.
// There is exactly one instance for given token in given injector.
//
// All the state is immutable, the only state changes is the cache. There is however no way to produce different instance under given token. In that sense it is immutable.
//
// Injector is responsible for:
// - resolving tokens into
//   - provider
//   - value (cache/calling provider)
// - loading different "providers" and modules
class Injector {

    constructor(modules = [], parentInjector = null, providers = new Map(), scopes = []) {
        this._cache = new Map();
        this._providers = providers;
        this._parent = parentInjector;
        this._scopes = scopes;

        this._tokenCache = new Map();

        this._loadModules(modules);
    }

    _retrieveToken(classConstructor, constructionParams = []) {
        if (!this._tokenCache.has(classConstructor)) {
            this._tokenCache.set(classConstructor, new Map());
        }

        let paramsHash = hash(constructionParams);
        let cachedClass = this._tokenCache.get(classConstructor);
        if (!cachedClass.has(paramsHash)) {
            /* Generate a new token */
            cachedClass.set(paramsHash, `${Date.now()}${Math.random()}`);
        }

        let foundHash = cachedClass.get(paramsHash);
        return classConstructor.name ? `${classConstructor.name}-${foundHash}` : foundHash;
    }


    // Collect all registered providers that has given annotation.
    // Including providers defined in parent injectors.
    _collectProvidersWithAnnotation(annotationClass, collectedProviders) {
        this._providers.forEach((provider, token) => {
            if (!collectedProviders.has(token) && hasAnnotation(provider.provider, annotationClass)) {
                collectedProviders.set(token, provider);
            }
        });

        if (this._parent) {
            this._parent._collectProvidersWithAnnotation(annotationClass, collectedProviders);
        }
    }


    // Load modules/function/classes.
    // This mutates `this._providers`, but it is only called during the constructor.
    _loadModules(modules) {
        for (var module of modules) {
            // A single provider (class or function).
            if (isFunction(module)) {
                this._loadFnOrClass(module);
                continue;
            }

            throw new Error('Invalid module!');
        }
    }


    // Load a function or class.
    // This mutates `this._providers`, but it is only called during the constructor.
    _loadFnOrClass(classConstructor, constructionParams = []) {
        var annotations = readAnnotations(classConstructor);
        var token = this._retrieveToken(annotations.provide.token || classConstructor, constructionParams);
        var provider = createProviderFromFnOrClass(classConstructor, annotations);

        this._providers.set(token, provider);
    }


    // Returns true if there is any provider registered for given token.
    // Including parent injectors.
    _hasProviderFor(token) {
        if (this._providers.has(token)) {
            return true;
        }

        if (this._parent) {
            return this._parent._hasProviderFor(token);
        }

        return false;
    }

    // Find the correct injector where the default provider should be instantiated and cached.
    _instantiateDefaultProvider(provider, token, classConstructor, constructionParams, resolving) {
        // In root injector, instantiate here.
        if (!this._parent) {
            this._providers.set(token, provider);
            return this.get(classConstructor, constructionParams, resolving);
        }

        // Check if this injector forces new instance of this provider.
        for (var ScopeClass of this._scopes) {
            if (hasAnnotation(provider.provider, ScopeClass)) {
                this._providers.set(token, provider);
                return this.get(token, resolving);
            }
        }

        // Otherwise ask parent injector.
        return this._parent._instantiateDefaultProvider(provider, token, resolving);
    }


    // Return an instance for given token.
    get(classConstructor, constructionParams = [], resolving = []) {
        var resolvingMsg = '';
        var provider;
        var instance;
        var token = this._retrieveToken(classConstructor, constructionParams);

        if (token === null || token === undefined) {
            resolvingMsg = constructResolvingMessage(resolving, token);
            throw new Error(`Invalid token "${token}" requested!${resolvingMsg}`);
        }

        // Special case, return itself.
        if (token === Injector) {
            return this;
        }

        // Check if there is a cached instance already.
        if (this._cache.has(token)) {
            instance = this._cache.get(token);
            provider = this._providers.get(token);
            return instance;
        }

        provider = this._providers.get(token);

        // No provider defined (overridden), use the default provider (token).
        if (!provider && isFunction(classConstructor) && !this._hasProviderFor(token)) {
            provider = createProviderFromFnOrClass(classConstructor, readAnnotations(classConstructor));
            return this._instantiateDefaultProvider(provider, token, classConstructor, constructionParams, resolving);
        }

        if (!provider) {
            if (!this._parent) {
                resolvingMsg = constructResolvingMessage(resolving, token);
                throw new Error(`No provider for ${toString(token)}!${resolvingMsg}`);
            }

            return this._parent.get(token, resolving);
        }

        if (resolving.indexOf(token) !== -1) {
            resolvingMsg = constructResolvingMessage(resolving, token);
            throw new Error(`Cannot instantiate cyclic dependency!${resolvingMsg}`);
        }

        resolving.push(token);

        var args = provider.params.map((param) => {
            return this.get(param.token, undefined, resolving);
        });

        /* Add custom construction parameters to construction */
        args = args.concat(constructionParams);

        try {
            instance = provider.create(args);
        } catch (e) {
            resolvingMsg = constructResolvingMessage(resolving);
            var originalMsg = 'ORIGINAL ERROR: ' + e.message;
            e.message = `Error during instantiation of ${toString(token)}!${resolvingMsg}\n${originalMsg}`;
            throw e;
        }

        if (!hasAnnotation(provider.provider, TransientScopeAnnotation)) {
            this._cache.set(token, instance);
        }

        resolving.pop();

        return instance;
    }


    // Create a child injector, which encapsulate shorter life scope.
    // It is possible to add additional providers and also force new instances of existing providers.
    createChild(modules = [], forceNewInstancesOf = []) {
        var forcedProviders = new Map();

        // Always force new instance of TransientScope.
        forceNewInstancesOf.push(TransientScopeAnnotation);

        for (var annotation of forceNewInstancesOf) {
            this._collectProvidersWithAnnotation(annotation, forcedProviders);
        }

        return new Injector(modules, this, forcedProviders, forceNewInstancesOf);
    }
}


export {Injector};
