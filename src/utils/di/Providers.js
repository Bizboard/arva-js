/* */
import {
    ClassProvider as ClassProviderAnnotation,
    FactoryProvider as FactoryProviderAnnotation,
    SuperConstructor as SuperConstructorAnnotation,
    readAnnotations,
    hasAnnotation
} from './Decorators.js';
import {isFunction, isObject, toString, isUpperCase, ownKeys} from './Util.js';

function isClass(clsOrFunction) {

    if (hasAnnotation(clsOrFunction, ClassProviderAnnotation)) {
        return true;
    } else if (hasAnnotation(clsOrFunction, FactoryProviderAnnotation)) {
        return false;
    }
    /* When code is minified, class names are no longer upper case, so we skip this check
     * if the name is oddly short (which happens during minification). */
    else if (clsOrFunction.name && clsOrFunction.name.length && clsOrFunction.name.length > 3) {
        return isUpperCase(clsOrFunction.name.charAt(0));
    } else {
        return ownKeys(clsOrFunction.prototype || {}).length > 0;
    }
}

// Provider is responsible for creating instances.
//
// responsibilities:
// - create instances
//
// communication:
// - exposes `create()` which creates an instance of something
// - exposes `params` (information about which arguments it requires to be passed into `create()`)
//
// Injector reads `provider.params` first, create these dependencies (however it wants),
// then calls `provider.create(args)`, passing in these arguments.


var EmptyFunction = Object.getPrototypeOf(Function);


// ClassProvider knows how to instantiate classes.
//
// If a class inherits (has parent constructors), this provider normalizes all the dependencies
// into a single flat array first, so that the injector does not need to worry about inheritance.
//
// - all the state is immutable (constructed)
//
// TODO(vojta): super constructor - should be only allowed during the constructor call?
class ClassProvider {
    constructor(clazz, params) {
        // TODO(vojta): can we hide this.provider? (only used for hasAnnotation(provider.provider))
        this.provider = clazz;

        this.params = [];
        this._constructors = [];

        this._flattenParams(clazz, params);
        this._constructors.unshift([clazz, 0, this.params.length - 1]);
    }

    // Normalize params for all the constructors (in the case of inheritance),
    // into a single flat array of DependencyDescriptors.
    // So that the injector does not have to worry about inheritance.
    //
    // This function mutates `this.params` and `this._constructors`,
    // but it is only called during the constructor.
    // TODO(vojta): remove the annotations argument?
    _flattenParams(constructor, params) {
        var SuperConstructor;
        var constructorInfo;

        for (var param of params) {
            if (param.token === SuperConstructorAnnotation) {
                SuperConstructor = Object.getPrototypeOf(constructor);

                if (SuperConstructor === EmptyFunction) {
                    throw new Error(`${toString(constructor)} does not have a parent constructor. Only classes with a parent can ask for SuperConstructor!`);
                }

                constructorInfo = [SuperConstructor, this.params.length];
                this._constructors.push(constructorInfo);
                this._flattenParams(SuperConstructor, readAnnotations(SuperConstructor).params);
                constructorInfo.push(this.params.length - 1);
            } else {
                this.params.push(param);
            }
        }
    }

    // Basically the reverse process to `this._flattenParams`:
    // We get arguments for all the constructors as a single flat array.
    // This method generates pre-bound "superConstructor" wrapper with correctly passing arguments.
    _createConstructor(currentConstructorIdx, context, allArguments) {
        var constructorInfo = this._constructors[currentConstructorIdx];
        var nextConstructorInfo = this._constructors[currentConstructorIdx + 1];
        var argsForCurrentConstructor;

        if (nextConstructorInfo) {
            argsForCurrentConstructor = allArguments
                .slice(constructorInfo[1], nextConstructorInfo[1])
                .concat([this._createConstructor(currentConstructorIdx + 1, context, allArguments)])
                .concat(allArguments.slice(nextConstructorInfo[2] + 1, constructorInfo[2] + 1));
        } else {
            argsForCurrentConstructor = allArguments
            /*.slice(constructorInfo[1], constructorInfo[2] + 1);*/
        }

        return function InjectedAndBoundSuperConstructor() {
            // https://stackoverflow.com/questions/33193310/constr-applythis-args-in-es6-classes
            return new (Function.prototype.bind.apply(constructorInfo[0], [context].concat(argsForCurrentConstructor)));
        };
    }

    // It is called by injector to create an instance.
    create(args) {
        var context = Object.create(this.provider.prototype);
        var constructor = this._createConstructor(0, context, args);
        var returnedValue = constructor();

        if (isFunction(returnedValue) || isObject(returnedValue)) {
            return returnedValue;
        }

        return context;
    }
}


// FactoryProvider knows how to create instance from a factory function.
// - all the state is immutable
class FactoryProvider {
    constructor(factoryFunction, params) {
        this.provider = factoryFunction;
        this.params = params;

        for (var param of params) {
            if (param.token === SuperConstructorAnnotation) {
                throw new Error(`${toString(factoryFunction)} is not a class. Only classes with a parent can ask for SuperConstructor!`);
            }
        }
    }

    create(args) {
        return this.provider.apply(undefined, args);
    }
}


export function createProviderFromFnOrClass(fnOrClass, annotations) {
    if (isClass(fnOrClass)) {
        return new ClassProvider(fnOrClass, annotations.params);
    }

    return new FactoryProvider(fnOrClass, annotations.params);
}
