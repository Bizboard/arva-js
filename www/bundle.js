"format register";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  function dedupe(deps) {
    var newDeps = [];
    for (var i = 0, l = deps.length; i < l; i++)
      if (indexOf.call(newDeps, deps[i]) == -1)
        newDeps.push(deps[i])
    return newDeps;
  }

  function register(name, deps, declare, execute) {
    if (typeof name != 'string')
      throw "System.register provided no module name";
    
    var entry;

    // dynamic
    if (typeof declare == 'boolean') {
      entry = {
        declarative: false,
        deps: deps,
        execute: execute,
        executingRequire: declare
      };
    }
    else {
      // ES6 declarative
      entry = {
        declarative: true,
        deps: deps,
        declare: declare
      };
    }

    entry.name = name;
    
    // we never overwrite an existing define
    if (!defined[name])
      defined[name] = entry; 

    entry.deps = dedupe(entry.deps);

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }

  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      
      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;
      
      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {
        
        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;
      exports[name] = value;

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });
    
    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute)
      throw new TypeError("Invalid System.register form for " + entry.name);

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = { 'default': depEntry.module.exports, __useDefault: true };
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);
    
      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);
    
    if (output)
      module.exports = output;
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    var module = entry.declarative ? entry.module.exports : { 'default': entry.module.exports, '__useDefault': true };

    // return the defined module object
    return modules[name] = module;
  };

  return function(main, declare) {

    var System;

    // if there's a system loader, define onto it
    if (typeof System != 'undefined' && System.register) {
      declare(System);
      System['import'](main);
    }
    // otherwise, self execute
    else {
      declare(System = {
        register: register, 
        get: load, 
        set: function(name, module) {
          modules[name] = module; 
        },
        newModule: function(module) {
          return module;
        },
        global: global 
      });
      System.set('@empty', System.newModule({}));
      load(main);
    }
  };

})(typeof window != 'undefined' ? window : global)
/* ('mainModule', function(System) {
  System.register(...);
}); */

('main', function(System) {

System.register("github:angular/di.js@master/util", [], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master/util";
  var ownKeys;
  function isUpperCase(char) {
    return char.toUpperCase() === char;
  }
  function isFunction(value) {
    return typeof value === 'function';
  }
  function isObject(value) {
    return typeof value === 'object';
  }
  function toString(token) {
    if (typeof token === 'string') {
      return token;
    }
    if (token === undefined || token === null) {
      return '' + token;
    }
    if (token.name) {
      return token.name;
    }
    return token.toString();
  }
  return {
    setters: [],
    execute: function() {
      ownKeys = (this.Reflect && Reflect.ownKeys ? Reflect.ownKeys : function ownKeys(O) {
        var keys = Object.getOwnPropertyNames(O);
        if (Object.getOwnPropertySymbols)
          return keys.concat(Object.getOwnPropertySymbols(O));
        return keys;
      });
      $__export("isUpperCase", isUpperCase), $__export("isFunction", isFunction), $__export("isObject", isObject), $__export("toString", toString), $__export("ownKeys", ownKeys);
    }
  };
});



System.register("github:angular/di.js@master/profiler", ["github:angular/di.js@master/util"], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master/profiler";
  var toString,
      IS_DEBUG,
      _global,
      globalCounter;
  function getUniqueId() {
    return ++globalCounter;
  }
  function serializeToken(token, tokens) {
    if (!tokens.has(token)) {
      tokens.set(token, getUniqueId().toString());
    }
    return tokens.get(token);
  }
  function serializeProvider(provider, key, tokens) {
    return {
      id: serializeToken(key, tokens),
      name: toString(key),
      isPromise: provider.isPromise,
      dependencies: provider.params.map(function(param) {
        return {
          token: serializeToken(param.token, tokens),
          isPromise: param.isPromise,
          isLazy: param.isLazy
        };
      })
    };
  }
  function serializeInjector(injector, tokens, Injector) {
    var serializedInjector = {
      id: serializeToken(injector, tokens),
      parent_id: injector._parent ? serializeToken(injector._parent, tokens) : null,
      providers: {}
    };
    var injectorClassId = serializeToken(Injector, tokens);
    serializedInjector.providers[injectorClassId] = {
      id: injectorClassId,
      name: toString(Injector),
      isPromise: false,
      dependencies: []
    };
    injector._providers.forEach(function(provider, key) {
      var serializedProvider = serializeProvider(provider, key, tokens);
      serializedInjector.providers[serializedProvider.id] = serializedProvider;
    });
    return serializedInjector;
  }
  function profileInjector(injector, Injector) {
    if (!IS_DEBUG) {
      return ;
    }
    if (!_global.__di_dump__) {
      _global.__di_dump__ = {
        injectors: [],
        tokens: new Map()
      };
    }
    _global.__di_dump__.injectors.push(serializeInjector(injector, _global.__di_dump__.tokens, Injector));
  }
  $__export("profileInjector", profileInjector);
  return {
    setters: [function($__m) {
      toString = $__m.toString;
    }],
    execute: function() {
      IS_DEBUG = false;
      _global = null;
      if (typeof process === 'object' && process.env) {
        IS_DEBUG = !!process.env['DEBUG'];
        _global = global;
      } else if (typeof location === 'object' && location.search) {
        IS_DEBUG = /di_debug/.test(location.search);
        _global = window;
      }
      globalCounter = 0;
    }
  };
});



System.register("github:angular/di.js@master/providers", ["github:angular/di.js@master/annotations", "github:angular/di.js@master/util"], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master/providers";
  var ClassProviderAnnotation,
      FactoryProviderAnnotation,
      SuperConstructorAnnotation,
      readAnnotations,
      hasAnnotation,
      isFunction,
      isObject,
      toString,
      isUpperCase,
      ownKeys,
      EmptyFunction,
      ClassProvider,
      FactoryProvider;
  function isClass(clsOrFunction) {
    if (hasAnnotation(clsOrFunction, ClassProviderAnnotation)) {
      return true;
    } else if (hasAnnotation(clsOrFunction, FactoryProviderAnnotation)) {
      return false;
    } else if (clsOrFunction.name) {
      return isUpperCase(clsOrFunction.name.charAt(0));
    } else {
      return ownKeys(clsOrFunction.prototype).length > 0;
    }
  }
  function createProviderFromFnOrClass(fnOrClass, annotations) {
    if (isClass(fnOrClass)) {
      return new ClassProvider(fnOrClass, annotations.params, annotations.provide.isPromise);
    }
    return new FactoryProvider(fnOrClass, annotations.params, annotations.provide.isPromise);
  }
  $__export("createProviderFromFnOrClass", createProviderFromFnOrClass);
  return {
    setters: [function($__m) {
      ClassProviderAnnotation = $__m.ClassProvider;
      FactoryProviderAnnotation = $__m.FactoryProvider;
      SuperConstructorAnnotation = $__m.SuperConstructor;
      readAnnotations = $__m.readAnnotations;
      hasAnnotation = $__m.hasAnnotation;
    }, function($__m) {
      isFunction = $__m.isFunction;
      isObject = $__m.isObject;
      toString = $__m.toString;
      isUpperCase = $__m.isUpperCase;
      ownKeys = $__m.ownKeys;
    }],
    execute: function() {
      EmptyFunction = Object.getPrototypeOf(Function);
      ClassProvider = (function() {
        var ClassProvider = function ClassProvider(clazz, params, isPromise) {
          this.provider = clazz;
          this.isPromise = isPromise;
          this.params = [];
          this._constructors = [];
          this._flattenParams(clazz, params);
          this._constructors.unshift([clazz, 0, this.params.length - 1]);
        };
        return ($traceurRuntime.createClass)(ClassProvider, {
          _flattenParams: function(constructor, params) {
            var SuperConstructor;
            var constructorInfo;
            for (var $__1 = params[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__2 = void 0; !($__2 = $__1.next()).done; ) {
              var param = $__2.value;
              {
                if (param.token === SuperConstructorAnnotation) {
                  SuperConstructor = Object.getPrototypeOf(constructor);
                  if (SuperConstructor === EmptyFunction) {
                    throw new Error((toString(constructor) + " does not have a parent constructor. Only classes with a parent can ask for SuperConstructor!"));
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
          },
          _createConstructor: function(currentConstructorIdx, context, allArguments) {
            var constructorInfo = this._constructors[currentConstructorIdx];
            var nextConstructorInfo = this._constructors[currentConstructorIdx + 1];
            var argsForCurrentConstructor;
            if (nextConstructorInfo) {
              argsForCurrentConstructor = allArguments.slice(constructorInfo[1], nextConstructorInfo[1]).concat([this._createConstructor(currentConstructorIdx + 1, context, allArguments)]).concat(allArguments.slice(nextConstructorInfo[2] + 1, constructorInfo[2] + 1));
            } else {
              argsForCurrentConstructor = allArguments.slice(constructorInfo[1], constructorInfo[2] + 1);
            }
            return function InjectedAndBoundSuperConstructor() {
              return constructorInfo[0].apply(context, argsForCurrentConstructor);
            };
          },
          create: function(args) {
            var context = Object.create(this.provider.prototype);
            var constructor = this._createConstructor(0, context, args);
            var returnedValue = constructor();
            if (isFunction(returnedValue) || isObject(returnedValue)) {
              return returnedValue;
            }
            return context;
          }
        }, {});
      }());
      FactoryProvider = (function() {
        var FactoryProvider = function FactoryProvider(factoryFunction, params, isPromise) {
          this.provider = factoryFunction;
          this.params = params;
          this.isPromise = isPromise;
          for (var $__1 = params[$traceurRuntime.toProperty(Symbol.iterator)](),
              $__2 = void 0; !($__2 = $__1.next()).done; ) {
            var param = $__2.value;
            {
              if (param.token === SuperConstructorAnnotation) {
                throw new Error((toString(factoryFunction) + " is not a class. Only classes with a parent can ask for SuperConstructor!"));
              }
            }
          }
        };
        return ($traceurRuntime.createClass)(FactoryProvider, {create: function(args) {
            return this.provider.apply(undefined, args);
          }}, {});
      }());
    }
  };
});



System.register("npm:process@0.10.1/browser", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var process = module.exports = {};
  var queue = [];
  var draining = false;
  function drainQueue() {
    if (draining) {
      return ;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while (len) {
      currentQueue = queue;
      queue = [];
      var i = -1;
      while (++i < len) {
        currentQueue[i]();
      }
      len = queue.length;
    }
    draining = false;
  }
  process.nextTick = function(fun) {
    queue.push(fun);
    if (!draining) {
      setTimeout(drainQueue, 0);
    }
  };
  process.title = 'browser';
  process.browser = true;
  process.env = {};
  process.argv = [];
  process.version = '';
  process.versions = {};
  function noop() {}
  process.on = noop;
  process.addListener = noop;
  process.once = noop;
  process.off = noop;
  process.removeListener = noop;
  process.removeAllListeners = noop;
  process.emit = noop;
  process.binding = function(name) {
    throw new Error('process.binding is not supported');
  };
  process.cwd = function() {
    return '/';
  };
  process.chdir = function(dir) {
    throw new Error('process.chdir is not supported');
  };
  process.umask = function() {
    return 0;
  };
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Entity", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var entities = [];
  function get(id) {
    return entities[id];
  }
  function set(id, entity) {
    entities[id] = entity;
  }
  function register(entity) {
    var id = entities.length;
    set(id, entity);
    return id;
  }
  function unregister(id) {
    set(id, null);
  }
  module.exports = {
    register: register,
    unregister: unregister,
    get: get,
    set: set
  };
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Transform", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Transform = {};
  Transform.precision = 0.000001;
  Transform.identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  Transform.multiply4x4 = function multiply4x4(a, b) {
    return [a[0] * b[0] + a[4] * b[1] + a[8] * b[2] + a[12] * b[3], a[1] * b[0] + a[5] * b[1] + a[9] * b[2] + a[13] * b[3], a[2] * b[0] + a[6] * b[1] + a[10] * b[2] + a[14] * b[3], a[3] * b[0] + a[7] * b[1] + a[11] * b[2] + a[15] * b[3], a[0] * b[4] + a[4] * b[5] + a[8] * b[6] + a[12] * b[7], a[1] * b[4] + a[5] * b[5] + a[9] * b[6] + a[13] * b[7], a[2] * b[4] + a[6] * b[5] + a[10] * b[6] + a[14] * b[7], a[3] * b[4] + a[7] * b[5] + a[11] * b[6] + a[15] * b[7], a[0] * b[8] + a[4] * b[9] + a[8] * b[10] + a[12] * b[11], a[1] * b[8] + a[5] * b[9] + a[9] * b[10] + a[13] * b[11], a[2] * b[8] + a[6] * b[9] + a[10] * b[10] + a[14] * b[11], a[3] * b[8] + a[7] * b[9] + a[11] * b[10] + a[15] * b[11], a[0] * b[12] + a[4] * b[13] + a[8] * b[14] + a[12] * b[15], a[1] * b[12] + a[5] * b[13] + a[9] * b[14] + a[13] * b[15], a[2] * b[12] + a[6] * b[13] + a[10] * b[14] + a[14] * b[15], a[3] * b[12] + a[7] * b[13] + a[11] * b[14] + a[15] * b[15]];
  };
  Transform.multiply = function multiply(a, b) {
    return [a[0] * b[0] + a[4] * b[1] + a[8] * b[2], a[1] * b[0] + a[5] * b[1] + a[9] * b[2], a[2] * b[0] + a[6] * b[1] + a[10] * b[2], 0, a[0] * b[4] + a[4] * b[5] + a[8] * b[6], a[1] * b[4] + a[5] * b[5] + a[9] * b[6], a[2] * b[4] + a[6] * b[5] + a[10] * b[6], 0, a[0] * b[8] + a[4] * b[9] + a[8] * b[10], a[1] * b[8] + a[5] * b[9] + a[9] * b[10], a[2] * b[8] + a[6] * b[9] + a[10] * b[10], 0, a[0] * b[12] + a[4] * b[13] + a[8] * b[14] + a[12], a[1] * b[12] + a[5] * b[13] + a[9] * b[14] + a[13], a[2] * b[12] + a[6] * b[13] + a[10] * b[14] + a[14], 1];
  };
  Transform.thenMove = function thenMove(m, t) {
    if (!t[2])
      t[2] = 0;
    return [m[0], m[1], m[2], 0, m[4], m[5], m[6], 0, m[8], m[9], m[10], 0, m[12] + t[0], m[13] + t[1], m[14] + t[2], 1];
  };
  Transform.moveThen = function moveThen(v, m) {
    if (!v[2])
      v[2] = 0;
    var t0 = v[0] * m[0] + v[1] * m[4] + v[2] * m[8];
    var t1 = v[0] * m[1] + v[1] * m[5] + v[2] * m[9];
    var t2 = v[0] * m[2] + v[1] * m[6] + v[2] * m[10];
    return Transform.thenMove(m, [t0, t1, t2]);
  };
  Transform.translate = function translate(x, y, z) {
    if (z === undefined)
      z = 0;
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  };
  Transform.thenScale = function thenScale(m, s) {
    return [s[0] * m[0], s[1] * m[1], s[2] * m[2], 0, s[0] * m[4], s[1] * m[5], s[2] * m[6], 0, s[0] * m[8], s[1] * m[9], s[2] * m[10], 0, s[0] * m[12], s[1] * m[13], s[2] * m[14], 1];
  };
  Transform.scale = function scale(x, y, z) {
    if (z === undefined)
      z = 1;
    if (y === undefined)
      y = x;
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  };
  Transform.rotateX = function rotateX(theta) {
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    return [1, 0, 0, 0, 0, cosTheta, sinTheta, 0, 0, -sinTheta, cosTheta, 0, 0, 0, 0, 1];
  };
  Transform.rotateY = function rotateY(theta) {
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    return [cosTheta, 0, -sinTheta, 0, 0, 1, 0, 0, sinTheta, 0, cosTheta, 0, 0, 0, 0, 1];
  };
  Transform.rotateZ = function rotateZ(theta) {
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    return [cosTheta, sinTheta, 0, 0, -sinTheta, cosTheta, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  };
  Transform.rotate = function rotate(phi, theta, psi) {
    var cosPhi = Math.cos(phi);
    var sinPhi = Math.sin(phi);
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    var cosPsi = Math.cos(psi);
    var sinPsi = Math.sin(psi);
    var result = [cosTheta * cosPsi, cosPhi * sinPsi + sinPhi * sinTheta * cosPsi, sinPhi * sinPsi - cosPhi * sinTheta * cosPsi, 0, -cosTheta * sinPsi, cosPhi * cosPsi - sinPhi * sinTheta * sinPsi, sinPhi * cosPsi + cosPhi * sinTheta * sinPsi, 0, sinTheta, -sinPhi * cosTheta, cosPhi * cosTheta, 0, 0, 0, 0, 1];
    return result;
  };
  Transform.rotateAxis = function rotateAxis(v, theta) {
    var sinTheta = Math.sin(theta);
    var cosTheta = Math.cos(theta);
    var verTheta = 1 - cosTheta;
    var xxV = v[0] * v[0] * verTheta;
    var xyV = v[0] * v[1] * verTheta;
    var xzV = v[0] * v[2] * verTheta;
    var yyV = v[1] * v[1] * verTheta;
    var yzV = v[1] * v[2] * verTheta;
    var zzV = v[2] * v[2] * verTheta;
    var xs = v[0] * sinTheta;
    var ys = v[1] * sinTheta;
    var zs = v[2] * sinTheta;
    var result = [xxV + cosTheta, xyV + zs, xzV - ys, 0, xyV - zs, yyV + cosTheta, yzV + xs, 0, xzV + ys, yzV - xs, zzV + cosTheta, 0, 0, 0, 0, 1];
    return result;
  };
  Transform.aboutOrigin = function aboutOrigin(v, m) {
    var t0 = v[0] - (v[0] * m[0] + v[1] * m[4] + v[2] * m[8]);
    var t1 = v[1] - (v[0] * m[1] + v[1] * m[5] + v[2] * m[9]);
    var t2 = v[2] - (v[0] * m[2] + v[1] * m[6] + v[2] * m[10]);
    return Transform.thenMove(m, [t0, t1, t2]);
  };
  Transform.skew = function skew(phi, theta, psi) {
    return [1, Math.tan(theta), 0, 0, Math.tan(psi), 1, 0, 0, 0, Math.tan(phi), 1, 0, 0, 0, 0, 1];
  };
  Transform.skewX = function skewX(angle) {
    return [1, 0, 0, 0, Math.tan(angle), 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  };
  Transform.skewY = function skewY(angle) {
    return [1, Math.tan(angle), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  };
  Transform.perspective = function perspective(focusZ) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / focusZ, 0, 0, 0, 1];
  };
  Transform.getTranslate = function getTranslate(m) {
    return [m[12], m[13], m[14]];
  };
  Transform.inverse = function inverse(m) {
    var c0 = m[5] * m[10] - m[6] * m[9];
    var c1 = m[4] * m[10] - m[6] * m[8];
    var c2 = m[4] * m[9] - m[5] * m[8];
    var c4 = m[1] * m[10] - m[2] * m[9];
    var c5 = m[0] * m[10] - m[2] * m[8];
    var c6 = m[0] * m[9] - m[1] * m[8];
    var c8 = m[1] * m[6] - m[2] * m[5];
    var c9 = m[0] * m[6] - m[2] * m[4];
    var c10 = m[0] * m[5] - m[1] * m[4];
    var detM = m[0] * c0 - m[1] * c1 + m[2] * c2;
    var invD = 1 / detM;
    var result = [invD * c0, -invD * c4, invD * c8, 0, -invD * c1, invD * c5, -invD * c9, 0, invD * c2, -invD * c6, invD * c10, 0, 0, 0, 0, 1];
    result[12] = -m[12] * result[0] - m[13] * result[4] - m[14] * result[8];
    result[13] = -m[12] * result[1] - m[13] * result[5] - m[14] * result[9];
    result[14] = -m[12] * result[2] - m[13] * result[6] - m[14] * result[10];
    return result;
  };
  Transform.transpose = function transpose(m) {
    return [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]];
  };
  function _normSquared(v) {
    return v.length === 2 ? v[0] * v[0] + v[1] * v[1] : v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  }
  function _norm(v) {
    return Math.sqrt(_normSquared(v));
  }
  function _sign(n) {
    return n < 0 ? -1 : 1;
  }
  Transform.interpret = function interpret(M) {
    var x = [M[0], M[1], M[2]];
    var sgn = _sign(x[0]);
    var xNorm = _norm(x);
    var v = [x[0] + sgn * xNorm, x[1], x[2]];
    var mult = 2 / _normSquared(v);
    if (mult >= Infinity) {
      return {
        translate: Transform.getTranslate(M),
        rotate: [0, 0, 0],
        scale: [0, 0, 0],
        skew: [0, 0, 0]
      };
    }
    var Q1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    Q1[0] = 1 - mult * v[0] * v[0];
    Q1[5] = 1 - mult * v[1] * v[1];
    Q1[10] = 1 - mult * v[2] * v[2];
    Q1[1] = -mult * v[0] * v[1];
    Q1[2] = -mult * v[0] * v[2];
    Q1[6] = -mult * v[1] * v[2];
    Q1[4] = Q1[1];
    Q1[8] = Q1[2];
    Q1[9] = Q1[6];
    var MQ1 = Transform.multiply(Q1, M);
    var x2 = [MQ1[5], MQ1[6]];
    var sgn2 = _sign(x2[0]);
    var x2Norm = _norm(x2);
    var v2 = [x2[0] + sgn2 * x2Norm, x2[1]];
    var mult2 = 2 / _normSquared(v2);
    var Q2 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    Q2[5] = 1 - mult2 * v2[0] * v2[0];
    Q2[10] = 1 - mult2 * v2[1] * v2[1];
    Q2[6] = -mult2 * v2[0] * v2[1];
    Q2[9] = Q2[6];
    var Q = Transform.multiply(Q2, Q1);
    var R = Transform.multiply(Q, M);
    var remover = Transform.scale(R[0] < 0 ? -1 : 1, R[5] < 0 ? -1 : 1, R[10] < 0 ? -1 : 1);
    R = Transform.multiply(R, remover);
    Q = Transform.multiply(remover, Q);
    var result = {};
    result.translate = Transform.getTranslate(M);
    result.rotate = [Math.atan2(-Q[6], Q[10]), Math.asin(Q[2]), Math.atan2(-Q[1], Q[0])];
    if (!result.rotate[0]) {
      result.rotate[0] = 0;
      result.rotate[2] = Math.atan2(Q[4], Q[5]);
    }
    result.scale = [R[0], R[5], R[10]];
    result.skew = [Math.atan2(R[9], result.scale[2]), Math.atan2(R[8], result.scale[2]), Math.atan2(R[4], result.scale[0])];
    if (Math.abs(result.rotate[0]) + Math.abs(result.rotate[2]) > 1.5 * Math.PI) {
      result.rotate[1] = Math.PI - result.rotate[1];
      if (result.rotate[1] > Math.PI)
        result.rotate[1] -= 2 * Math.PI;
      if (result.rotate[1] < -Math.PI)
        result.rotate[1] += 2 * Math.PI;
      if (result.rotate[0] < 0)
        result.rotate[0] += Math.PI;
      else
        result.rotate[0] -= Math.PI;
      if (result.rotate[2] < 0)
        result.rotate[2] += Math.PI;
      else
        result.rotate[2] -= Math.PI;
    }
    return result;
  };
  Transform.average = function average(M1, M2, t) {
    t = t === undefined ? 0.5 : t;
    var specM1 = Transform.interpret(M1);
    var specM2 = Transform.interpret(M2);
    var specAvg = {
      translate: [0, 0, 0],
      rotate: [0, 0, 0],
      scale: [0, 0, 0],
      skew: [0, 0, 0]
    };
    for (var i = 0; i < 3; i++) {
      specAvg.translate[i] = (1 - t) * specM1.translate[i] + t * specM2.translate[i];
      specAvg.rotate[i] = (1 - t) * specM1.rotate[i] + t * specM2.rotate[i];
      specAvg.scale[i] = (1 - t) * specM1.scale[i] + t * specM2.scale[i];
      specAvg.skew[i] = (1 - t) * specM1.skew[i] + t * specM2.skew[i];
    }
    return Transform.build(specAvg);
  };
  Transform.build = function build(spec) {
    var scaleMatrix = Transform.scale(spec.scale[0], spec.scale[1], spec.scale[2]);
    var skewMatrix = Transform.skew(spec.skew[0], spec.skew[1], spec.skew[2]);
    var rotateMatrix = Transform.rotate(spec.rotate[0], spec.rotate[1], spec.rotate[2]);
    return Transform.thenMove(Transform.multiply(Transform.multiply(rotateMatrix, skewMatrix), scaleMatrix), spec.translate);
  };
  Transform.equals = function equals(a, b) {
    return !Transform.notEquals(a, b);
  };
  Transform.notEquals = function notEquals(a, b) {
    if (a === b)
      return false;
    return !(a && b) || a[12] !== b[12] || a[13] !== b[13] || a[14] !== b[14] || a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[4] !== b[4] || a[5] !== b[5] || a[6] !== b[6] || a[8] !== b[8] || a[9] !== b[9] || a[10] !== b[10];
  };
  Transform.normalizeRotation = function normalizeRotation(rotation) {
    var result = rotation.slice(0);
    if (result[0] === Math.PI * 0.5 || result[0] === -Math.PI * 0.5) {
      result[0] = -result[0];
      result[1] = Math.PI - result[1];
      result[2] -= Math.PI;
    }
    if (result[0] > Math.PI * 0.5) {
      result[0] = result[0] - Math.PI;
      result[1] = Math.PI - result[1];
      result[2] -= Math.PI;
    }
    if (result[0] < -Math.PI * 0.5) {
      result[0] = result[0] + Math.PI;
      result[1] = -Math.PI - result[1];
      result[2] -= Math.PI;
    }
    while (result[1] < -Math.PI)
      result[1] += 2 * Math.PI;
    while (result[1] >= Math.PI)
      result[1] -= 2 * Math.PI;
    while (result[2] < -Math.PI)
      result[2] += 2 * Math.PI;
    while (result[2] >= Math.PI)
      result[2] -= 2 * Math.PI;
    return result;
  };
  Transform.inFront = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0.001, 1];
  Transform.behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -0.001, 1];
  module.exports = Transform;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/EventEmitter", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  function EventEmitter() {
    this.listeners = {};
    this._owner = this;
  }
  EventEmitter.prototype.emit = function emit(type, event) {
    var handlers = this.listeners[type];
    if (handlers) {
      for (var i = 0; i < handlers.length; i++) {
        handlers[i].call(this._owner, event);
      }
    }
    return this;
  };
  EventEmitter.prototype.on = function on(type, handler) {
    if (!(type in this.listeners))
      this.listeners[type] = [];
    var index = this.listeners[type].indexOf(handler);
    if (index < 0)
      this.listeners[type].push(handler);
    return this;
  };
  EventEmitter.prototype.addListener = EventEmitter.prototype.on;
  EventEmitter.prototype.removeListener = function removeListener(type, handler) {
    var listener = this.listeners[type];
    if (listener !== undefined) {
      var index = listener.indexOf(handler);
      if (index >= 0)
        listener.splice(index, 1);
    }
    return this;
  };
  EventEmitter.prototype.bindThis = function bindThis(owner) {
    this._owner = owner;
  };
  module.exports = EventEmitter;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/ElementAllocator", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  function ElementAllocator(container) {
    if (!container)
      container = document.createDocumentFragment();
    this.container = container;
    this.detachedNodes = {};
    this.nodeCount = 0;
  }
  ElementAllocator.prototype.migrate = function migrate(container) {
    var oldContainer = this.container;
    if (container === oldContainer)
      return ;
    if (oldContainer instanceof DocumentFragment) {
      container.appendChild(oldContainer);
    } else {
      while (oldContainer.hasChildNodes()) {
        container.appendChild(oldContainer.firstChild);
      }
    }
    this.container = container;
  };
  ElementAllocator.prototype.allocate = function allocate(type) {
    type = type.toLowerCase();
    if (!(type in this.detachedNodes))
      this.detachedNodes[type] = [];
    var nodeStore = this.detachedNodes[type];
    var result;
    if (nodeStore.length > 0) {
      result = nodeStore.pop();
    } else {
      result = document.createElement(type);
      this.container.appendChild(result);
    }
    this.nodeCount++;
    return result;
  };
  ElementAllocator.prototype.deallocate = function deallocate(element) {
    var nodeType = element.nodeName.toLowerCase();
    var nodeStore = this.detachedNodes[nodeType];
    nodeStore.push(element);
    this.nodeCount--;
  };
  ElementAllocator.prototype.getNodeCount = function getNodeCount() {
    return this.nodeCount;
  };
  module.exports = ElementAllocator;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/utilities/Utility", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Utility = {};
  Utility.Direction = {
    X: 0,
    Y: 1,
    Z: 2
  };
  Utility.after = function after(count, callback) {
    var counter = count;
    return function() {
      counter--;
      if (counter === 0)
        callback.apply(this, arguments);
    };
  };
  Utility.loadURL = function loadURL(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function onreadystatechange() {
      if (this.readyState === 4) {
        if (callback)
          callback(this.responseText);
      }
    };
    xhr.open('GET', url);
    xhr.send();
  };
  Utility.createDocumentFragmentFromHTML = function createDocumentFragmentFromHTML(html) {
    var element = document.createElement('div');
    element.innerHTML = html;
    var result = document.createDocumentFragment();
    while (element.hasChildNodes())
      result.appendChild(element.firstChild);
    return result;
  };
  Utility.clone = function clone(b) {
    var a;
    if (typeof b === 'object') {
      a = b instanceof Array ? [] : {};
      for (var key in b) {
        if (typeof b[key] === 'object' && b[key] !== null) {
          if (b[key] instanceof Array) {
            a[key] = new Array(b[key].length);
            for (var i = 0; i < b[key].length; i++) {
              a[key][i] = Utility.clone(b[key][i]);
            }
          } else {
            a[key] = Utility.clone(b[key]);
          }
        } else {
          a[key] = b[key];
        }
      }
    } else {
      a = b;
    }
    return a;
  };
  module.exports = Utility;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/transitions/TweenTransition", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  function TweenTransition(options) {
    this.options = Object.create(TweenTransition.DEFAULT_OPTIONS);
    if (options)
      this.setOptions(options);
    this._startTime = 0;
    this._startValue = 0;
    this._updateTime = 0;
    this._endValue = 0;
    this._curve = undefined;
    this._duration = 0;
    this._active = false;
    this._callback = undefined;
    this.state = 0;
    this.velocity = undefined;
  }
  TweenTransition.Curves = {
    linear: function(t) {
      return t;
    },
    easeIn: function(t) {
      return t * t;
    },
    easeOut: function(t) {
      return t * (2 - t);
    },
    easeInOut: function(t) {
      if (t <= 0.5)
        return 2 * t * t;
      else
        return -2 * t * t + 4 * t - 1;
    },
    easeOutBounce: function(t) {
      return t * (3 - 2 * t);
    },
    spring: function(t) {
      return (1 - t) * Math.sin(6 * Math.PI * t) + t;
    }
  };
  TweenTransition.SUPPORTS_MULTIPLE = true;
  TweenTransition.DEFAULT_OPTIONS = {
    curve: TweenTransition.Curves.linear,
    duration: 500,
    speed: 0
  };
  var registeredCurves = {};
  TweenTransition.registerCurve = function registerCurve(curveName, curve) {
    if (!registeredCurves[curveName]) {
      registeredCurves[curveName] = curve;
      return true;
    } else {
      return false;
    }
  };
  TweenTransition.unregisterCurve = function unregisterCurve(curveName) {
    if (registeredCurves[curveName]) {
      delete registeredCurves[curveName];
      return true;
    } else {
      return false;
    }
  };
  TweenTransition.getCurve = function getCurve(curveName) {
    var curve = registeredCurves[curveName];
    if (curve !== undefined)
      return curve;
    else
      throw new Error('curve not registered');
  };
  TweenTransition.getCurves = function getCurves() {
    return registeredCurves;
  };
  function _interpolate(a, b, t) {
    return (1 - t) * a + t * b;
  }
  function _clone(obj) {
    if (obj instanceof Object) {
      if (obj instanceof Array)
        return obj.slice(0);
      else
        return Object.create(obj);
    } else
      return obj;
  }
  function _normalize(transition, defaultTransition) {
    var result = {curve: defaultTransition.curve};
    if (defaultTransition.duration)
      result.duration = defaultTransition.duration;
    if (defaultTransition.speed)
      result.speed = defaultTransition.speed;
    if (transition instanceof Object) {
      if (transition.duration !== undefined)
        result.duration = transition.duration;
      if (transition.curve)
        result.curve = transition.curve;
      if (transition.speed)
        result.speed = transition.speed;
    }
    if (typeof result.curve === 'string')
      result.curve = TweenTransition.getCurve(result.curve);
    return result;
  }
  TweenTransition.prototype.setOptions = function setOptions(options) {
    if (options.curve !== undefined)
      this.options.curve = options.curve;
    if (options.duration !== undefined)
      this.options.duration = options.duration;
    if (options.speed !== undefined)
      this.options.speed = options.speed;
  };
  TweenTransition.prototype.set = function set(endValue, transition, callback) {
    if (!transition) {
      this.reset(endValue);
      if (callback)
        callback();
      return ;
    }
    this._startValue = _clone(this.get());
    transition = _normalize(transition, this.options);
    if (transition.speed) {
      var startValue = this._startValue;
      if (startValue instanceof Object) {
        var variance = 0;
        for (var i in startValue)
          variance += (endValue[i] - startValue[i]) * (endValue[i] - startValue[i]);
        transition.duration = Math.sqrt(variance) / transition.speed;
      } else {
        transition.duration = Math.abs(endValue - startValue) / transition.speed;
      }
    }
    this._startTime = Date.now();
    this._endValue = _clone(endValue);
    this._startVelocity = _clone(transition.velocity);
    this._duration = transition.duration;
    this._curve = transition.curve;
    this._active = true;
    this._callback = callback;
  };
  TweenTransition.prototype.reset = function reset(startValue, startVelocity) {
    if (this._callback) {
      var callback = this._callback;
      this._callback = undefined;
      callback();
    }
    this.state = _clone(startValue);
    this.velocity = _clone(startVelocity);
    this._startTime = 0;
    this._duration = 0;
    this._updateTime = 0;
    this._startValue = this.state;
    this._startVelocity = this.velocity;
    this._endValue = this.state;
    this._active = false;
  };
  TweenTransition.prototype.getVelocity = function getVelocity() {
    return this.velocity;
  };
  TweenTransition.prototype.get = function get(timestamp) {
    this.update(timestamp);
    return this.state;
  };
  function _calculateVelocity(current, start, curve, duration, t) {
    var velocity;
    var eps = 1e-7;
    var speed = (curve(t) - curve(t - eps)) / eps;
    if (current instanceof Array) {
      velocity = [];
      for (var i = 0; i < current.length; i++) {
        if (typeof current[i] === 'number')
          velocity[i] = speed * (current[i] - start[i]) / duration;
        else
          velocity[i] = 0;
      }
    } else
      velocity = speed * (current - start) / duration;
    return velocity;
  }
  function _calculateState(start, end, t) {
    var state;
    if (start instanceof Array) {
      state = [];
      for (var i = 0; i < start.length; i++) {
        if (typeof start[i] === 'number')
          state[i] = _interpolate(start[i], end[i], t);
        else
          state[i] = start[i];
      }
    } else
      state = _interpolate(start, end, t);
    return state;
  }
  TweenTransition.prototype.update = function update(timestamp) {
    if (!this._active) {
      if (this._callback) {
        var callback = this._callback;
        this._callback = undefined;
        callback();
      }
      return ;
    }
    if (!timestamp)
      timestamp = Date.now();
    if (this._updateTime >= timestamp)
      return ;
    this._updateTime = timestamp;
    var timeSinceStart = timestamp - this._startTime;
    if (timeSinceStart >= this._duration) {
      this.state = this._endValue;
      this.velocity = _calculateVelocity(this.state, this._startValue, this._curve, this._duration, 1);
      this._active = false;
    } else if (timeSinceStart < 0) {
      this.state = this._startValue;
      this.velocity = this._startVelocity;
    } else {
      var t = timeSinceStart / this._duration;
      this.state = _calculateState(this._startValue, this._endValue, this._curve(t));
      this.velocity = _calculateVelocity(this.state, this._startValue, this._curve, this._duration, t);
    }
  };
  TweenTransition.prototype.isActive = function isActive() {
    return this._active;
  };
  TweenTransition.prototype.halt = function halt() {
    this.reset(this.get());
  };
  TweenTransition.registerCurve('linear', TweenTransition.Curves.linear);
  TweenTransition.registerCurve('easeIn', TweenTransition.Curves.easeIn);
  TweenTransition.registerCurve('easeOut', TweenTransition.Curves.easeOut);
  TweenTransition.registerCurve('easeInOut', TweenTransition.Curves.easeInOut);
  TweenTransition.registerCurve('easeOutBounce', TweenTransition.Curves.easeOutBounce);
  TweenTransition.registerCurve('spring', TweenTransition.Curves.spring);
  TweenTransition.customCurve = function customCurve(v1, v2) {
    v1 = v1 || 0;
    v2 = v2 || 0;
    return function(t) {
      return v1 * t + (-2 * v1 - v2 + 3) * t * t + (v1 + v2 - 2) * t * t * t;
    };
  };
  module.exports = TweenTransition;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/OptionsManager", ["npm:famous@0.3.5/core/EventHandler"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  function OptionsManager(value) {
    this._value = value;
    this.eventOutput = null;
  }
  OptionsManager.patch = function patchObject(source, data) {
    var manager = new OptionsManager(source);
    for (var i = 1; i < arguments.length; i++)
      manager.patch(arguments[i]);
    return source;
  };
  function _createEventOutput() {
    this.eventOutput = new EventHandler();
    this.eventOutput.bindThis(this);
    EventHandler.setOutputHandler(this, this.eventOutput);
  }
  OptionsManager.prototype.patch = function patch() {
    var myState = this._value;
    for (var i = 0; i < arguments.length; i++) {
      var data = arguments[i];
      for (var k in data) {
        if (k in myState && (data[k] && data[k].constructor === Object) && (myState[k] && myState[k].constructor === Object)) {
          if (!myState.hasOwnProperty(k))
            myState[k] = Object.create(myState[k]);
          this.key(k).patch(data[k]);
          if (this.eventOutput)
            this.eventOutput.emit('change', {
              id: k,
              value: this.key(k).value()
            });
        } else
          this.set(k, data[k]);
      }
    }
    return this;
  };
  OptionsManager.prototype.setOptions = OptionsManager.prototype.patch;
  OptionsManager.prototype.key = function key(identifier) {
    var result = new OptionsManager(this._value[identifier]);
    if (!(result._value instanceof Object) || result._value instanceof Array)
      result._value = {};
    return result;
  };
  OptionsManager.prototype.get = function get(key) {
    return key ? this._value[key] : this._value;
  };
  OptionsManager.prototype.getOptions = OptionsManager.prototype.get;
  OptionsManager.prototype.set = function set(key, value) {
    var originalValue = this.get(key);
    this._value[key] = value;
    if (this.eventOutput && value !== originalValue)
      this.eventOutput.emit('change', {
        id: key,
        value: value
      });
    return this;
  };
  OptionsManager.prototype.on = function on() {
    _createEventOutput.call(this);
    return this.on.apply(this, arguments);
  };
  OptionsManager.prototype.removeListener = function removeListener() {
    _createEventOutput.call(this);
    return this.removeListener.apply(this, arguments);
  };
  OptionsManager.prototype.pipe = function pipe() {
    _createEventOutput.call(this);
    return this.pipe.apply(this, arguments);
  };
  OptionsManager.prototype.unpipe = function unpipe() {
    _createEventOutput.call(this);
    return this.unpipe.apply(this, arguments);
  };
  module.exports = OptionsManager;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/ElementOutput", ["npm:famous@0.3.5/core/Entity", "npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/Transform"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Entity = require("npm:famous@0.3.5/core/Entity");
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var usePrefix = !('transform' in document.documentElement.style);
  var devicePixelRatio = window.devicePixelRatio || 1;
  function ElementOutput(element) {
    this._matrix = null;
    this._opacity = 1;
    this._origin = null;
    this._size = null;
    this._eventOutput = new EventHandler();
    this._eventOutput.bindThis(this);
    this.eventForwarder = function eventForwarder(event) {
      this._eventOutput.emit(event.type, event);
    }.bind(this);
    this.id = Entity.register(this);
    this._element = null;
    this._sizeDirty = false;
    this._originDirty = false;
    this._transformDirty = false;
    this._invisible = false;
    if (element)
      this.attach(element);
  }
  ElementOutput.prototype.on = function on(type, fn) {
    if (this._element)
      this._element.addEventListener(type, this.eventForwarder);
    this._eventOutput.on(type, fn);
  };
  ElementOutput.prototype.removeListener = function removeListener(type, fn) {
    this._eventOutput.removeListener(type, fn);
  };
  ElementOutput.prototype.emit = function emit(type, event) {
    if (event && !event.origin)
      event.origin = this;
    var handled = this._eventOutput.emit(type, event);
    if (handled && event && event.stopPropagation)
      event.stopPropagation();
    return handled;
  };
  ElementOutput.prototype.pipe = function pipe(target) {
    return this._eventOutput.pipe(target);
  };
  ElementOutput.prototype.unpipe = function unpipe(target) {
    return this._eventOutput.unpipe(target);
  };
  ElementOutput.prototype.render = function render() {
    return this.id;
  };
  function _addEventListeners(target) {
    for (var i in this._eventOutput.listeners) {
      target.addEventListener(i, this.eventForwarder);
    }
  }
  function _removeEventListeners(target) {
    for (var i in this._eventOutput.listeners) {
      target.removeEventListener(i, this.eventForwarder);
    }
  }
  function _formatCSSTransform(m) {
    m[12] = Math.round(m[12] * devicePixelRatio) / devicePixelRatio;
    m[13] = Math.round(m[13] * devicePixelRatio) / devicePixelRatio;
    var result = 'matrix3d(';
    for (var i = 0; i < 15; i++) {
      result += m[i] < 0.000001 && m[i] > -0.000001 ? '0,' : m[i] + ',';
    }
    result += m[15] + ')';
    return result;
  }
  var _setMatrix;
  if (usePrefix) {
    _setMatrix = function(element, matrix) {
      element.style.webkitTransform = _formatCSSTransform(matrix);
    };
  } else {
    _setMatrix = function(element, matrix) {
      element.style.transform = _formatCSSTransform(matrix);
    };
  }
  function _formatCSSOrigin(origin) {
    return 100 * origin[0] + '% ' + 100 * origin[1] + '%';
  }
  var _setOrigin = usePrefix ? function(element, origin) {
    element.style.webkitTransformOrigin = _formatCSSOrigin(origin);
  } : function(element, origin) {
    element.style.transformOrigin = _formatCSSOrigin(origin);
  };
  var _setInvisible = usePrefix ? function(element) {
    element.style.webkitTransform = 'scale3d(0.0001,0.0001,0.0001)';
    element.style.opacity = 0;
  } : function(element) {
    element.style.transform = 'scale3d(0.0001,0.0001,0.0001)';
    element.style.opacity = 0;
  };
  function _xyNotEquals(a, b) {
    return a && b ? a[0] !== b[0] || a[1] !== b[1] : a !== b;
  }
  ElementOutput.prototype.commit = function commit(context) {
    var target = this._element;
    if (!target)
      return ;
    var matrix = context.transform;
    var opacity = context.opacity;
    var origin = context.origin;
    var size = context.size;
    if (!matrix && this._matrix) {
      this._matrix = null;
      this._opacity = 0;
      _setInvisible(target);
      return ;
    }
    if (_xyNotEquals(this._origin, origin))
      this._originDirty = true;
    if (Transform.notEquals(this._matrix, matrix))
      this._transformDirty = true;
    if (this._invisible) {
      this._invisible = false;
      this._element.style.display = '';
    }
    if (this._opacity !== opacity) {
      this._opacity = opacity;
      target.style.opacity = opacity >= 1 ? '0.999999' : opacity;
    }
    if (this._transformDirty || this._originDirty || this._sizeDirty) {
      if (this._sizeDirty)
        this._sizeDirty = false;
      if (this._originDirty) {
        if (origin) {
          if (!this._origin)
            this._origin = [0, 0];
          this._origin[0] = origin[0];
          this._origin[1] = origin[1];
        } else
          this._origin = null;
        _setOrigin(target, this._origin);
        this._originDirty = false;
      }
      if (!matrix)
        matrix = Transform.identity;
      this._matrix = matrix;
      var aaMatrix = this._size ? Transform.thenMove(matrix, [-this._size[0] * origin[0], -this._size[1] * origin[1], 0]) : matrix;
      _setMatrix(target, aaMatrix);
      this._transformDirty = false;
    }
  };
  ElementOutput.prototype.cleanup = function cleanup() {
    if (this._element) {
      this._invisible = true;
      this._element.style.display = 'none';
    }
  };
  ElementOutput.prototype.attach = function attach(target) {
    this._element = target;
    _addEventListeners.call(this, target);
  };
  ElementOutput.prototype.detach = function detach() {
    var target = this._element;
    if (target) {
      _removeEventListeners.call(this, target);
      if (this._invisible) {
        this._invisible = false;
        this._element.style.display = '';
      }
    }
    this._element = null;
    return target;
  };
  module.exports = ElementOutput;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/transitions/TransitionableTransform", ["npm:famous@0.3.5/transitions/Transitionable", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/utilities/Utility"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Utility = require("npm:famous@0.3.5/utilities/Utility");
  function TransitionableTransform(transform) {
    this._final = Transform.identity.slice();
    this._finalTranslate = [0, 0, 0];
    this._finalRotate = [0, 0, 0];
    this._finalSkew = [0, 0, 0];
    this._finalScale = [1, 1, 1];
    this.translate = new Transitionable(this._finalTranslate);
    this.rotate = new Transitionable(this._finalRotate);
    this.skew = new Transitionable(this._finalSkew);
    this.scale = new Transitionable(this._finalScale);
    if (transform)
      this.set(transform);
  }
  function _build() {
    return Transform.build({
      translate: this.translate.get(),
      rotate: this.rotate.get(),
      skew: this.skew.get(),
      scale: this.scale.get()
    });
  }
  function _buildFinal() {
    return Transform.build({
      translate: this._finalTranslate,
      rotate: this._finalRotate,
      skew: this._finalSkew,
      scale: this._finalScale
    });
  }
  TransitionableTransform.prototype.setTranslate = function setTranslate(translate, transition, callback) {
    this._finalTranslate = translate;
    this._final = _buildFinal.call(this);
    this.translate.set(translate, transition, callback);
    return this;
  };
  TransitionableTransform.prototype.setScale = function setScale(scale, transition, callback) {
    this._finalScale = scale;
    this._final = _buildFinal.call(this);
    this.scale.set(scale, transition, callback);
    return this;
  };
  TransitionableTransform.prototype.setRotate = function setRotate(eulerAngles, transition, callback) {
    this._finalRotate = eulerAngles;
    this._final = _buildFinal.call(this);
    this.rotate.set(eulerAngles, transition, callback);
    return this;
  };
  TransitionableTransform.prototype.setSkew = function setSkew(skewAngles, transition, callback) {
    this._finalSkew = skewAngles;
    this._final = _buildFinal.call(this);
    this.skew.set(skewAngles, transition, callback);
    return this;
  };
  TransitionableTransform.prototype.set = function set(transform, transition, callback) {
    var components = Transform.interpret(transform);
    this._finalTranslate = components.translate;
    this._finalRotate = components.rotate;
    this._finalSkew = components.skew;
    this._finalScale = components.scale;
    this._final = transform;
    var _callback = callback ? Utility.after(4, callback) : null;
    this.translate.set(components.translate, transition, _callback);
    this.rotate.set(components.rotate, transition, _callback);
    this.skew.set(components.skew, transition, _callback);
    this.scale.set(components.scale, transition, _callback);
    return this;
  };
  TransitionableTransform.prototype.setDefaultTransition = function setDefaultTransition(transition) {
    this.translate.setDefault(transition);
    this.rotate.setDefault(transition);
    this.skew.setDefault(transition);
    this.scale.setDefault(transition);
  };
  TransitionableTransform.prototype.get = function get() {
    if (this.isActive()) {
      return _build.call(this);
    } else
      return this._final;
  };
  TransitionableTransform.prototype.getFinal = function getFinal() {
    return this._final;
  };
  TransitionableTransform.prototype.isActive = function isActive() {
    return this.translate.isActive() || this.rotate.isActive() || this.scale.isActive() || this.skew.isActive();
  };
  TransitionableTransform.prototype.halt = function halt() {
    this.translate.halt();
    this.rotate.halt();
    this.skew.halt();
    this.scale.halt();
    this._final = this.get();
    this._finalTranslate = this.translate.get();
    this._finalRotate = this.rotate.get();
    this._finalSkew = this.skew.get();
    this._finalScale = this.scale.get();
    return this;
  };
  module.exports = TransitionableTransform;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/View", ["npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/OptionsManager", "npm:famous@0.3.5/core/RenderNode", "npm:famous@0.3.5/utilities/Utility"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
  var RenderNode = require("npm:famous@0.3.5/core/RenderNode");
  var Utility = require("npm:famous@0.3.5/utilities/Utility");
  function View(options) {
    this._node = new RenderNode();
    this._eventInput = new EventHandler();
    this._eventOutput = new EventHandler();
    EventHandler.setInputHandler(this, this._eventInput);
    EventHandler.setOutputHandler(this, this._eventOutput);
    this.options = Utility.clone(this.constructor.DEFAULT_OPTIONS || View.DEFAULT_OPTIONS);
    this._optionsManager = new OptionsManager(this.options);
    if (options)
      this.setOptions(options);
  }
  View.DEFAULT_OPTIONS = {};
  View.prototype.getOptions = function getOptions(key) {
    return this._optionsManager.getOptions(key);
  };
  View.prototype.setOptions = function setOptions(options) {
    this._optionsManager.patch(options);
  };
  View.prototype.add = function add() {
    return this._node.add.apply(this._node, arguments);
  };
  View.prototype._add = View.prototype.add;
  View.prototype.render = function render() {
    return this._node.render();
  };
  View.prototype.getSize = function getSize() {
    if (this._node && this._node.getSize) {
      return this._node.getSize.apply(this._node, arguments) || this.options.size;
    } else
      return this.options.size;
  };
  module.exports = View;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/ViewSequence", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  function ViewSequence(options) {
    if (!options)
      options = [];
    if (options instanceof Array)
      options = {array: options};
    this._ = null;
    this.index = options.index || 0;
    if (options.array)
      this._ = new this.constructor.Backing(options.array);
    else if (options._)
      this._ = options._;
    if (this.index === this._.firstIndex)
      this._.firstNode = this;
    if (this.index === this._.firstIndex + this._.array.length - 1)
      this._.lastNode = this;
    if (options.loop !== undefined)
      this._.loop = options.loop;
    if (options.trackSize !== undefined)
      this._.trackSize = options.trackSize;
    this._previousNode = null;
    this._nextNode = null;
  }
  ViewSequence.Backing = function Backing(array) {
    this.array = array;
    this.firstIndex = 0;
    this.loop = false;
    this.firstNode = null;
    this.lastNode = null;
    this.cumulativeSizes = [[0, 0]];
    this.sizeDirty = true;
    this.trackSize = false;
  };
  ViewSequence.Backing.prototype.getValue = function getValue(i) {
    var _i = i - this.firstIndex;
    if (_i < 0 || _i >= this.array.length)
      return null;
    return this.array[_i];
  };
  ViewSequence.Backing.prototype.setValue = function setValue(i, value) {
    this.array[i - this.firstIndex] = value;
  };
  ViewSequence.Backing.prototype.getSize = function getSize(index) {
    return this.cumulativeSizes[index];
  };
  ViewSequence.Backing.prototype.calculateSize = function calculateSize(index) {
    index = index || this.array.length;
    var size = [0, 0];
    for (var i = 0; i < index; i++) {
      var nodeSize = this.array[i].getSize();
      if (!nodeSize)
        return undefined;
      if (size[0] !== undefined) {
        if (nodeSize[0] === undefined)
          size[0] = undefined;
        else
          size[0] += nodeSize[0];
      }
      if (size[1] !== undefined) {
        if (nodeSize[1] === undefined)
          size[1] = undefined;
        else
          size[1] += nodeSize[1];
      }
      this.cumulativeSizes[i + 1] = size.slice();
    }
    this.sizeDirty = false;
    return size;
  };
  ViewSequence.Backing.prototype.reindex = function reindex(start, removeCount, insertCount) {
    if (!this.array[0])
      return ;
    var i = 0;
    var index = this.firstIndex;
    var indexShiftAmount = insertCount - removeCount;
    var node = this.firstNode;
    while (index < start - 1) {
      node = node.getNext();
      index++;
    }
    var spliceStartNode = node;
    for (i = 0; i < removeCount; i++) {
      node = node.getNext();
      if (node)
        node._previousNode = spliceStartNode;
    }
    var spliceResumeNode = node ? node.getNext() : null;
    spliceStartNode._nextNode = null;
    node = spliceStartNode;
    for (i = 0; i < insertCount; i++)
      node = node.getNext();
    index += insertCount;
    if (node !== spliceResumeNode) {
      node._nextNode = spliceResumeNode;
      if (spliceResumeNode)
        spliceResumeNode._previousNode = node;
    }
    if (spliceResumeNode) {
      node = spliceResumeNode;
      index++;
      while (node && index < this.array.length + this.firstIndex) {
        if (node._nextNode)
          node.index += indexShiftAmount;
        else
          node.index = index;
        node = node.getNext();
        index++;
      }
    }
    if (this.trackSize)
      this.sizeDirty = true;
  };
  ViewSequence.prototype.getPrevious = function getPrevious() {
    var len = this._.array.length;
    if (!len) {
      this._previousNode = null;
    } else if (this.index === this._.firstIndex) {
      if (this._.loop) {
        this._previousNode = this._.lastNode || new this.constructor({
          _: this._,
          index: this._.firstIndex + len - 1
        });
        this._previousNode._nextNode = this;
      } else {
        this._previousNode = null;
      }
    } else if (!this._previousNode) {
      this._previousNode = new this.constructor({
        _: this._,
        index: this.index - 1
      });
      this._previousNode._nextNode = this;
    }
    return this._previousNode;
  };
  ViewSequence.prototype.getNext = function getNext() {
    var len = this._.array.length;
    if (!len) {
      this._nextNode = null;
    } else if (this.index === this._.firstIndex + len - 1) {
      if (this._.loop) {
        this._nextNode = this._.firstNode || new this.constructor({
          _: this._,
          index: this._.firstIndex
        });
        this._nextNode._previousNode = this;
      } else {
        this._nextNode = null;
      }
    } else if (!this._nextNode) {
      this._nextNode = new this.constructor({
        _: this._,
        index: this.index + 1
      });
      this._nextNode._previousNode = this;
    }
    return this._nextNode;
  };
  ViewSequence.prototype.indexOf = function indexOf(item) {
    return this._.array.indexOf(item);
  };
  ViewSequence.prototype.getIndex = function getIndex() {
    return this.index;
  };
  ViewSequence.prototype.toString = function toString() {
    return '' + this.index;
  };
  ViewSequence.prototype.unshift = function unshift(value) {
    this._.array.unshift.apply(this._.array, arguments);
    this._.firstIndex -= arguments.length;
    if (this._.trackSize)
      this._.sizeDirty = true;
  };
  ViewSequence.prototype.push = function push(value) {
    this._.array.push.apply(this._.array, arguments);
    if (this._.trackSize)
      this._.sizeDirty = true;
  };
  ViewSequence.prototype.splice = function splice(index, howMany) {
    var values = Array.prototype.slice.call(arguments, 2);
    this._.array.splice.apply(this._.array, [index - this._.firstIndex, howMany].concat(values));
    this._.reindex(index, howMany, values.length);
  };
  ViewSequence.prototype.swap = function swap(other) {
    var otherValue = other.get();
    var myValue = this.get();
    this._.setValue(this.index, otherValue);
    this._.setValue(other.index, myValue);
    var myPrevious = this._previousNode;
    var myNext = this._nextNode;
    var myIndex = this.index;
    var otherPrevious = other._previousNode;
    var otherNext = other._nextNode;
    var otherIndex = other.index;
    this.index = otherIndex;
    this._previousNode = otherPrevious === this ? other : otherPrevious;
    if (this._previousNode)
      this._previousNode._nextNode = this;
    this._nextNode = otherNext === this ? other : otherNext;
    if (this._nextNode)
      this._nextNode._previousNode = this;
    other.index = myIndex;
    other._previousNode = myPrevious === other ? this : myPrevious;
    if (other._previousNode)
      other._previousNode._nextNode = other;
    other._nextNode = myNext === other ? this : myNext;
    if (other._nextNode)
      other._nextNode._previousNode = other;
    if (this.index === this._.firstIndex)
      this._.firstNode = this;
    else if (this.index === this._.firstIndex + this._.array.length - 1)
      this._.lastNode = this;
    if (other.index === this._.firstIndex)
      this._.firstNode = other;
    else if (other.index === this._.firstIndex + this._.array.length - 1)
      this._.lastNode = other;
    if (this._.trackSize)
      this._.sizeDirty = true;
  };
  ViewSequence.prototype.get = function get() {
    return this._.getValue(this.index);
  };
  ViewSequence.prototype.getSize = function getSize() {
    var target = this.get();
    return target ? target.getSize() : null;
  };
  ViewSequence.prototype.render = function render() {
    if (this._.trackSize && this._.sizeDirty)
      this._.calculateSize();
    var target = this.get();
    return target ? target.render.apply(target, arguments) : null;
  };
  module.exports = ViewSequence;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility", ["npm:famous@0.3.5/utilities/Utility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Utility = require("npm:famous@0.3.5/utilities/Utility");
    function LayoutUtility() {}
    LayoutUtility.registeredHelpers = {};
    var Capabilities = {
      SEQUENCE: 1,
      DIRECTION_X: 2,
      DIRECTION_Y: 4,
      SCROLLING: 8
    };
    LayoutUtility.Capabilities = Capabilities;
    LayoutUtility.normalizeMargins = function(margins) {
      if (!margins) {
        return [0, 0, 0, 0];
      } else if (!Array.isArray(margins)) {
        return [margins, margins, margins, margins];
      } else if (margins.length === 0) {
        return [0, 0, 0, 0];
      } else if (margins.length === 1) {
        return [margins[0], margins[0], margins[0], margins[0]];
      } else if (margins.length === 2) {
        return [margins[0], margins[1], margins[0], margins[1]];
      } else {
        return margins;
      }
    };
    LayoutUtility.cloneSpec = function(spec) {
      var clone = {};
      if (spec.opacity !== undefined) {
        clone.opacity = spec.opacity;
      }
      if (spec.size !== undefined) {
        clone.size = spec.size.slice(0);
      }
      if (spec.transform !== undefined) {
        clone.transform = spec.transform.slice(0);
      }
      if (spec.origin !== undefined) {
        clone.origin = spec.origin.slice(0);
      }
      if (spec.align !== undefined) {
        clone.align = spec.align.slice(0);
      }
      return clone;
    };
    function _isEqualArray(a, b) {
      if (a === b) {
        return true;
      }
      if ((a === undefined) || (b === undefined)) {
        return false;
      }
      var i = a.length;
      if (i !== b.length) {
        return false;
      }
      while (i--) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    }
    LayoutUtility.isEqualSpec = function(spec1, spec2) {
      if (spec1.opacity !== spec2.opacity) {
        return false;
      }
      if (!_isEqualArray(spec1.size, spec2.size)) {
        return false;
      }
      if (!_isEqualArray(spec1.transform, spec2.transform)) {
        return false;
      }
      if (!_isEqualArray(spec1.origin, spec2.origin)) {
        return false;
      }
      if (!_isEqualArray(spec1.align, spec2.align)) {
        return false;
      }
      return true;
    };
    LayoutUtility.getSpecDiffText = function(spec1, spec2) {
      var result = 'spec diff:';
      if (spec1.opacity !== spec2.opacity) {
        result += '\nopacity: ' + spec1.opacity + ' != ' + spec2.opacity;
      }
      if (!_isEqualArray(spec1.size, spec2.size)) {
        result += '\nsize: ' + JSON.stringify(spec1.size) + ' != ' + JSON.stringify(spec2.size);
      }
      if (!_isEqualArray(spec1.transform, spec2.transform)) {
        result += '\ntransform: ' + JSON.stringify(spec1.transform) + ' != ' + JSON.stringify(spec2.transform);
      }
      if (!_isEqualArray(spec1.origin, spec2.origin)) {
        result += '\norigin: ' + JSON.stringify(spec1.origin) + ' != ' + JSON.stringify(spec2.origin);
      }
      if (!_isEqualArray(spec1.align, spec2.align)) {
        result += '\nalign: ' + JSON.stringify(spec1.align) + ' != ' + JSON.stringify(spec2.align);
      }
      return result;
    };
    LayoutUtility.error = function(message) {
      console.log('ERROR: ' + message);
      throw message;
    };
    LayoutUtility.warning = function(message) {
      console.log('WARNING: ' + message);
    };
    LayoutUtility.log = function(args) {
      var message = '';
      for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if ((arg instanceof Object) || (arg instanceof Array)) {
          message += JSON.stringify(arg);
        } else {
          message += arg;
        }
      }
      console.log(message);
    };
    LayoutUtility.combineOptions = function(options1, options2, forceClone) {
      if (options1 && !options2 && !forceClone) {
        return options1;
      } else if (!options1 && options2 && !forceClone) {
        return options2;
      }
      var options = Utility.clone(options1 || {});
      if (options2) {
        for (var key in options2) {
          options[key] = options2[key];
        }
      }
      return options;
    };
    LayoutUtility.registerHelper = function(name, Helper) {
      if (!Helper.prototype.parse) {
        LayoutUtility.error('The layout-helper for name "' + name + '" is required to support the "parse" method');
      }
      if (this.registeredHelpers[name] !== undefined) {
        LayoutUtility.warning('A layout-helper with the name "' + name + '" is already registered and will be overwritten');
      }
      this.registeredHelpers[name] = Helper;
    };
    LayoutUtility.unregisterHelper = function(name) {
      delete this.registeredHelpers[name];
    };
    LayoutUtility.getRegisteredHelper = function(name) {
      return this.registeredHelpers[name];
    };
    module.exports = LayoutUtility;
  }).call(__exports, __require, __exports, __module);
});


})();
(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/LayoutContext", [], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    function LayoutContext(methods) {
      for (var n in methods) {
        this[n] = methods[n];
      }
    }
    LayoutContext.prototype.size = undefined;
    LayoutContext.prototype.direction = undefined;
    LayoutContext.prototype.scrollOffset = undefined;
    LayoutContext.prototype.scrollStart = undefined;
    LayoutContext.prototype.scrollEnd = undefined;
    LayoutContext.prototype.next = function() {};
    LayoutContext.prototype.prev = function() {};
    LayoutContext.prototype.get = function(node) {};
    LayoutContext.prototype.set = function(node, set) {};
    LayoutContext.prototype.resolveSize = function(node) {};
    module.exports = LayoutContext;
  }).call(__exports, __require, __exports, __module);
});


})();
(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode", ["npm:famous@0.3.5/core/Transform", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Transform = require("npm:famous@0.3.5/core/Transform");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    function LayoutNode(renderNode, spec) {
      this.renderNode = renderNode;
      this._spec = spec ? LayoutUtility.cloneSpec(spec) : {};
      this._spec.renderNode = renderNode;
      this._specModified = true;
      this._invalidated = false;
      this._removing = false;
    }
    LayoutNode.prototype.setRenderNode = function(renderNode) {
      this.renderNode = renderNode;
      this._spec.renderNode = renderNode;
    };
    LayoutNode.prototype.setOptions = function(options) {};
    LayoutNode.prototype.destroy = function() {
      this.renderNode = undefined;
      this._spec.renderNode = undefined;
      this._viewSequence = undefined;
    };
    LayoutNode.prototype.reset = function() {
      this._invalidated = false;
      this.trueSizeRequested = false;
    };
    LayoutNode.prototype.setSpec = function(spec) {
      this._specModified = true;
      if (spec.align) {
        if (!spec.align) {
          this._spec.align = [0, 0];
        }
        this._spec.align[0] = spec.align[0];
        this._spec.align[1] = spec.align[1];
      } else {
        this._spec.align = undefined;
      }
      if (spec.origin) {
        if (!spec.origin) {
          this._spec.origin = [0, 0];
        }
        this._spec.origin[0] = spec.origin[0];
        this._spec.origin[1] = spec.origin[1];
      } else {
        this._spec.origin = undefined;
      }
      if (spec.size) {
        if (!spec.size) {
          this._spec.size = [0, 0];
        }
        this._spec.size[0] = spec.size[0];
        this._spec.size[1] = spec.size[1];
      } else {
        this._spec.size = undefined;
      }
      if (spec.transform) {
        if (!spec.transform) {
          this._spec.transform = spec.transform.slice(0);
        } else {
          for (var i = 0; i < 16; i++) {
            this._spec.transform[i] = spec.transform[i];
          }
        }
      } else {
        this._spec.transform = undefined;
      }
      this._spec.opacity = spec.opacity;
    };
    LayoutNode.prototype.set = function(set, size) {
      this._invalidated = true;
      this._specModified = true;
      this._removing = false;
      var spec = this._spec;
      spec.opacity = set.opacity;
      if (set.size) {
        if (!spec.size) {
          spec.size = [0, 0];
        }
        spec.size[0] = set.size[0];
        spec.size[1] = set.size[1];
      } else {
        spec.size = undefined;
      }
      if (set.origin) {
        if (!spec.origin) {
          spec.origin = [0, 0];
        }
        spec.origin[0] = set.origin[0];
        spec.origin[1] = set.origin[1];
      } else {
        spec.origin = undefined;
      }
      if (set.align) {
        if (!spec.align) {
          spec.align = [0, 0];
        }
        spec.align[0] = set.align[0];
        spec.align[1] = set.align[1];
      } else {
        spec.align = undefined;
      }
      if (set.skew || set.rotate || set.scale) {
        this._spec.transform = Transform.build({
          translate: set.translate || [0, 0, 0],
          skew: set.skew || [0, 0, 0],
          scale: set.scale || [1, 1, 1],
          rotate: set.rotate || [0, 0, 0]
        });
      } else if (set.translate) {
        this._spec.transform = Transform.translate(set.translate[0], set.translate[1], set.translate[2]);
      } else {
        this._spec.transform = undefined;
      }
      this.scrollLength = set.scrollLength;
    };
    LayoutNode.prototype.getSpec = function() {
      this._specModified = false;
      this._spec.removed = !this._invalidated;
      return this._spec;
    };
    LayoutNode.prototype.remove = function(removeSpec) {
      this._removing = true;
    };
    module.exports = LayoutNode;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("npm:famous@0.3.5/math/Vector", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  function Vector(x, y, z) {
    if (arguments.length === 1 && x !== undefined)
      this.set(x);
    else {
      this.x = x || 0;
      this.y = y || 0;
      this.z = z || 0;
    }
    return this;
  }
  var _register = new Vector(0, 0, 0);
  Vector.prototype.add = function add(v) {
    return _setXYZ.call(_register, this.x + v.x, this.y + v.y, this.z + v.z);
  };
  Vector.prototype.sub = function sub(v) {
    return _setXYZ.call(_register, this.x - v.x, this.y - v.y, this.z - v.z);
  };
  Vector.prototype.mult = function mult(r) {
    return _setXYZ.call(_register, r * this.x, r * this.y, r * this.z);
  };
  Vector.prototype.div = function div(r) {
    return this.mult(1 / r);
  };
  Vector.prototype.cross = function cross(v) {
    var x = this.x;
    var y = this.y;
    var z = this.z;
    var vx = v.x;
    var vy = v.y;
    var vz = v.z;
    return _setXYZ.call(_register, z * vy - y * vz, x * vz - z * vx, y * vx - x * vy);
  };
  Vector.prototype.equals = function equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  };
  Vector.prototype.rotateX = function rotateX(theta) {
    var x = this.x;
    var y = this.y;
    var z = this.z;
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    return _setXYZ.call(_register, x, y * cosTheta - z * sinTheta, y * sinTheta + z * cosTheta);
  };
  Vector.prototype.rotateY = function rotateY(theta) {
    var x = this.x;
    var y = this.y;
    var z = this.z;
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    return _setXYZ.call(_register, z * sinTheta + x * cosTheta, y, z * cosTheta - x * sinTheta);
  };
  Vector.prototype.rotateZ = function rotateZ(theta) {
    var x = this.x;
    var y = this.y;
    var z = this.z;
    var cosTheta = Math.cos(theta);
    var sinTheta = Math.sin(theta);
    return _setXYZ.call(_register, x * cosTheta - y * sinTheta, x * sinTheta + y * cosTheta, z);
  };
  Vector.prototype.dot = function dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  };
  Vector.prototype.normSquared = function normSquared() {
    return this.dot(this);
  };
  Vector.prototype.norm = function norm() {
    return Math.sqrt(this.normSquared());
  };
  Vector.prototype.normalize = function normalize(length) {
    if (arguments.length === 0)
      length = 1;
    var norm = this.norm();
    if (norm > 1e-7)
      return _setFromVector.call(_register, this.mult(length / norm));
    else
      return _setXYZ.call(_register, length, 0, 0);
  };
  Vector.prototype.clone = function clone() {
    return new Vector(this);
  };
  Vector.prototype.isZero = function isZero() {
    return !(this.x || this.y || this.z);
  };
  function _setXYZ(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  function _setFromArray(v) {
    return _setXYZ.call(this, v[0], v[1], v[2] || 0);
  }
  function _setFromVector(v) {
    return _setXYZ.call(this, v.x, v.y, v.z);
  }
  function _setFromNumber(x) {
    return _setXYZ.call(this, x, 0, 0);
  }
  Vector.prototype.set = function set(v) {
    if (v instanceof Array)
      return _setFromArray.call(this, v);
    if (typeof v === 'number')
      return _setFromNumber.call(this, v);
    return _setFromVector.call(this, v);
  };
  Vector.prototype.setXYZ = function(x, y, z) {
    return _setXYZ.apply(this, arguments);
  };
  Vector.prototype.set1D = function(x) {
    return _setFromNumber.call(this, x);
  };
  Vector.prototype.put = function put(v) {
    if (this === _register)
      _setFromVector.call(v, _register);
    else
      _setFromVector.call(v, this);
  };
  Vector.prototype.clear = function clear() {
    return _setXYZ.call(this, 0, 0, 0);
  };
  Vector.prototype.cap = function cap(cap) {
    if (cap === Infinity)
      return _setFromVector.call(_register, this);
    var norm = this.norm();
    if (norm > cap)
      return _setFromVector.call(_register, this.mult(cap / norm));
    else
      return _setFromVector.call(_register, this);
  };
  Vector.prototype.project = function project(n) {
    return n.mult(this.dot(n));
  };
  Vector.prototype.reflectAcross = function reflectAcross(n) {
    n.normalize().put(n);
    return _setFromVector(_register, this.sub(this.project(n).mult(2)));
  };
  Vector.prototype.get = function get() {
    return [this.x, this.y, this.z];
  };
  Vector.prototype.get1D = function() {
    return this.x;
  };
  module.exports = Vector;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/physics/integrators/SymplecticEuler", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var SymplecticEuler = {};
  SymplecticEuler.integrateVelocity = function integrateVelocity(body, dt) {
    var v = body.velocity;
    var w = body.inverseMass;
    var f = body.force;
    if (f.isZero())
      return ;
    v.add(f.mult(dt * w)).put(v);
    f.clear();
  };
  SymplecticEuler.integratePosition = function integratePosition(body, dt) {
    var p = body.position;
    var v = body.velocity;
    p.add(v.mult(dt)).put(p);
  };
  SymplecticEuler.integrateAngularMomentum = function integrateAngularMomentum(body, dt) {
    var L = body.angularMomentum;
    var t = body.torque;
    if (t.isZero())
      return ;
    L.add(t.mult(dt)).put(L);
    t.clear();
  };
  SymplecticEuler.integrateOrientation = function integrateOrientation(body, dt) {
    var q = body.orientation;
    var w = body.angularVelocity;
    if (w.isZero())
      return ;
    q.add(q.multiply(w).scalarMultiply(0.5 * dt)).put(q);
  };
  module.exports = SymplecticEuler;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/physics/forces/Force", ["npm:famous@0.3.5/math/Vector", "npm:famous@0.3.5/core/EventHandler"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Vector = require("npm:famous@0.3.5/math/Vector");
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  function Force(force) {
    this.force = new Vector(force);
    this._eventOutput = new EventHandler();
    EventHandler.setOutputHandler(this, this._eventOutput);
  }
  Force.prototype.setOptions = function setOptions(options) {
    this._eventOutput.emit('change', options);
  };
  Force.prototype.applyForce = function applyForce(targets) {
    var length = targets.length;
    while (length--) {
      targets[length].applyForce(this.force);
    }
  };
  Force.prototype.getEnergy = function getEnergy() {
    return 0;
  };
  module.exports = Force;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/physics/PhysicsEngine", ["npm:famous@0.3.5/core/EventHandler"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  function PhysicsEngine(options) {
    this.options = Object.create(PhysicsEngine.DEFAULT_OPTIONS);
    if (options)
      this.setOptions(options);
    this._particles = [];
    this._bodies = [];
    this._agentData = {};
    this._forces = [];
    this._constraints = [];
    this._buffer = 0;
    this._prevTime = now();
    this._isSleeping = false;
    this._eventHandler = null;
    this._currAgentId = 0;
    this._hasBodies = false;
    this._eventHandler = null;
  }
  var TIMESTEP = 17;
  var MIN_TIME_STEP = 1000 / 120;
  var MAX_TIME_STEP = 17;
  var now = Date.now;
  var _events = {
    start: 'start',
    update: 'update',
    end: 'end'
  };
  PhysicsEngine.DEFAULT_OPTIONS = {
    constraintSteps: 1,
    sleepTolerance: 1e-7,
    velocityCap: undefined,
    angularVelocityCap: undefined
  };
  PhysicsEngine.prototype.setOptions = function setOptions(opts) {
    for (var key in opts)
      if (this.options[key])
        this.options[key] = opts[key];
  };
  PhysicsEngine.prototype.addBody = function addBody(body) {
    body._engine = this;
    if (body.isBody) {
      this._bodies.push(body);
      this._hasBodies = true;
    } else
      this._particles.push(body);
    body.on('start', this.wake.bind(this));
    return body;
  };
  PhysicsEngine.prototype.removeBody = function removeBody(body) {
    var array = body.isBody ? this._bodies : this._particles;
    var index = array.indexOf(body);
    if (index > -1) {
      for (var agentKey in this._agentData) {
        if (this._agentData.hasOwnProperty(agentKey)) {
          this.detachFrom(this._agentData[agentKey].id, body);
        }
      }
      array.splice(index, 1);
    }
    if (this.getBodies().length === 0)
      this._hasBodies = false;
  };
  function _mapAgentArray(agent) {
    if (agent.applyForce)
      return this._forces;
    if (agent.applyConstraint)
      return this._constraints;
  }
  function _attachOne(agent, targets, source) {
    if (targets === undefined)
      targets = this.getParticlesAndBodies();
    if (!(targets instanceof Array))
      targets = [targets];
    agent.on('change', this.wake.bind(this));
    this._agentData[this._currAgentId] = {
      agent: agent,
      id: this._currAgentId,
      targets: targets,
      source: source
    };
    _mapAgentArray.call(this, agent).push(this._currAgentId);
    return this._currAgentId++;
  }
  PhysicsEngine.prototype.attach = function attach(agents, targets, source) {
    this.wake();
    if (agents instanceof Array) {
      var agentIDs = [];
      for (var i = 0; i < agents.length; i++)
        agentIDs[i] = _attachOne.call(this, agents[i], targets, source);
      return agentIDs;
    } else
      return _attachOne.call(this, agents, targets, source);
  };
  PhysicsEngine.prototype.attachTo = function attachTo(agentID, target) {
    _getAgentData.call(this, agentID).targets.push(target);
  };
  PhysicsEngine.prototype.detach = function detach(id) {
    var agent = this.getAgent(id);
    var agentArray = _mapAgentArray.call(this, agent);
    var index = agentArray.indexOf(id);
    agentArray.splice(index, 1);
    delete this._agentData[id];
  };
  PhysicsEngine.prototype.detachFrom = function detachFrom(id, target) {
    var boundAgent = _getAgentData.call(this, id);
    if (boundAgent.source === target)
      this.detach(id);
    else {
      var targets = boundAgent.targets;
      var index = targets.indexOf(target);
      if (index > -1)
        targets.splice(index, 1);
    }
  };
  PhysicsEngine.prototype.detachAll = function detachAll() {
    this._agentData = {};
    this._forces = [];
    this._constraints = [];
    this._currAgentId = 0;
  };
  function _getAgentData(id) {
    return this._agentData[id];
  }
  PhysicsEngine.prototype.getAgent = function getAgent(id) {
    return _getAgentData.call(this, id).agent;
  };
  PhysicsEngine.prototype.getParticles = function getParticles() {
    return this._particles;
  };
  PhysicsEngine.prototype.getBodies = function getBodies() {
    return this._bodies;
  };
  PhysicsEngine.prototype.getParticlesAndBodies = function getParticlesAndBodies() {
    return this.getParticles().concat(this.getBodies());
  };
  PhysicsEngine.prototype.forEachParticle = function forEachParticle(fn, dt) {
    var particles = this.getParticles();
    for (var index = 0,
        len = particles.length; index < len; index++)
      fn.call(this, particles[index], dt);
  };
  PhysicsEngine.prototype.forEachBody = function forEachBody(fn, dt) {
    if (!this._hasBodies)
      return ;
    var bodies = this.getBodies();
    for (var index = 0,
        len = bodies.length; index < len; index++)
      fn.call(this, bodies[index], dt);
  };
  PhysicsEngine.prototype.forEach = function forEach(fn, dt) {
    this.forEachParticle(fn, dt);
    this.forEachBody(fn, dt);
  };
  function _updateForce(index) {
    var boundAgent = _getAgentData.call(this, this._forces[index]);
    boundAgent.agent.applyForce(boundAgent.targets, boundAgent.source);
  }
  function _updateForces() {
    for (var index = this._forces.length - 1; index > -1; index--)
      _updateForce.call(this, index);
  }
  function _updateConstraint(index, dt) {
    var boundAgent = this._agentData[this._constraints[index]];
    return boundAgent.agent.applyConstraint(boundAgent.targets, boundAgent.source, dt);
  }
  function _updateConstraints(dt) {
    var iteration = 0;
    while (iteration < this.options.constraintSteps) {
      for (var index = this._constraints.length - 1; index > -1; index--)
        _updateConstraint.call(this, index, dt);
      iteration++;
    }
  }
  function _updateVelocities(body, dt) {
    body.integrateVelocity(dt);
    if (this.options.velocityCap)
      body.velocity.cap(this.options.velocityCap).put(body.velocity);
  }
  function _updateAngularVelocities(body, dt) {
    body.integrateAngularMomentum(dt);
    body.updateAngularVelocity();
    if (this.options.angularVelocityCap)
      body.angularVelocity.cap(this.options.angularVelocityCap).put(body.angularVelocity);
  }
  function _updateOrientations(body, dt) {
    body.integrateOrientation(dt);
  }
  function _updatePositions(body, dt) {
    body.integratePosition(dt);
    body.emit(_events.update, body);
  }
  function _integrate(dt) {
    _updateForces.call(this, dt);
    this.forEach(_updateVelocities, dt);
    this.forEachBody(_updateAngularVelocities, dt);
    _updateConstraints.call(this, dt);
    this.forEachBody(_updateOrientations, dt);
    this.forEach(_updatePositions, dt);
  }
  function _getParticlesEnergy() {
    var energy = 0;
    var particleEnergy = 0;
    this.forEach(function(particle) {
      particleEnergy = particle.getEnergy();
      energy += particleEnergy;
    });
    return energy;
  }
  function _getAgentsEnergy() {
    var energy = 0;
    for (var id in this._agentData)
      energy += this.getAgentEnergy(id);
    return energy;
  }
  PhysicsEngine.prototype.getAgentEnergy = function(agentId) {
    var agentData = _getAgentData.call(this, agentId);
    return agentData.agent.getEnergy(agentData.targets, agentData.source);
  };
  PhysicsEngine.prototype.getEnergy = function getEnergy() {
    return _getParticlesEnergy.call(this) + _getAgentsEnergy.call(this);
  };
  PhysicsEngine.prototype.step = function step() {
    if (this.isSleeping())
      return ;
    var currTime = now();
    var dtFrame = currTime - this._prevTime;
    this._prevTime = currTime;
    if (dtFrame < MIN_TIME_STEP)
      return ;
    if (dtFrame > MAX_TIME_STEP)
      dtFrame = MAX_TIME_STEP;
    _integrate.call(this, TIMESTEP);
    this.emit(_events.update, this);
    if (this.getEnergy() < this.options.sleepTolerance)
      this.sleep();
  };
  PhysicsEngine.prototype.isSleeping = function isSleeping() {
    return this._isSleeping;
  };
  PhysicsEngine.prototype.isActive = function isSleeping() {
    return !this._isSleeping;
  };
  PhysicsEngine.prototype.sleep = function sleep() {
    if (this._isSleeping)
      return ;
    this.forEach(function(body) {
      body.sleep();
    });
    this.emit(_events.end, this);
    this._isSleeping = true;
  };
  PhysicsEngine.prototype.wake = function wake() {
    if (!this._isSleeping)
      return ;
    this._prevTime = now();
    this.emit(_events.start, this);
    this._isSleeping = false;
  };
  PhysicsEngine.prototype.emit = function emit(type, data) {
    if (this._eventHandler === null)
      return ;
    this._eventHandler.emit(type, data);
  };
  PhysicsEngine.prototype.on = function on(event, fn) {
    if (this._eventHandler === null)
      this._eventHandler = new EventHandler();
    this._eventHandler.on(event, fn);
  };
  module.exports = PhysicsEngine;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/helpers/LayoutDockHelper", ["github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    function LayoutDockHelper(context, options) {
      var size = context.size;
      this._size = size;
      this._context = context;
      this._options = options;
      this._z = (options && options.translateZ) ? options.translateZ : 0;
      if (options && options.margins) {
        var margins = LayoutUtility.normalizeMargins(options.margins);
        this._left = margins[3];
        this._top = margins[0];
        this._right = size[0] - margins[1];
        this._bottom = size[1] - margins[2];
      } else {
        this._left = 0;
        this._top = 0;
        this._right = size[0];
        this._bottom = size[1];
      }
    }
    LayoutDockHelper.prototype.parse = function(data) {
      for (var i = 0; i < data.length; i++) {
        var rule = data[i];
        var value = (rule.length >= 3) ? rule[2] : undefined;
        if (rule[0] === 'top') {
          this.top(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        } else if (rule[0] === 'left') {
          this.left(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        } else if (rule[0] === 'right') {
          this.right(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        } else if (rule[0] === 'bottom') {
          this.bottom(rule[1], value, (rule.length >= 4) ? rule[3] : undefined);
        } else if (rule[0] === 'fill') {
          this.fill(rule[1], (rule.length >= 3) ? rule[2] : undefined);
        } else if (rule[0] === 'margins') {
          this.margins(rule[1]);
        }
      }
    };
    LayoutDockHelper.prototype.top = function(node, height, z) {
      if (height instanceof Array) {
        height = height[1];
      }
      if (height === undefined) {
        var size = this._context.resolveSize(node, [this._right - this._left, this._bottom - this._top]);
        height = size[1];
      }
      this._context.set(node, {
        size: [this._right - this._left, height],
        origin: [0, 0],
        align: [0, 0],
        translate: [this._left, this._top, (z === undefined) ? this._z : z]
      });
      this._top += height;
      return this;
    };
    LayoutDockHelper.prototype.left = function(node, width, z) {
      if (width instanceof Array) {
        width = width[0];
      }
      if (width === undefined) {
        var size = this._context.resolveSize(node, [this._right - this._left, this._bottom - this._top]);
        width = size[0];
      }
      this._context.set(node, {
        size: [width, this._bottom - this._top],
        origin: [0, 0],
        align: [0, 0],
        translate: [this._left, this._top, (z === undefined) ? this._z : z]
      });
      this._left += width;
      return this;
    };
    LayoutDockHelper.prototype.bottom = function(node, height, z) {
      if (height instanceof Array) {
        height = height[1];
      }
      if (height === undefined) {
        var size = this._context.resolveSize(node, [this._right - this._left, this._bottom - this._top]);
        height = size[1];
      }
      this._context.set(node, {
        size: [this._right - this._left, height],
        origin: [0, 1],
        align: [0, 1],
        translate: [this._left, -(this._size[1] - this._bottom), (z === undefined) ? this._z : z]
      });
      this._bottom -= height;
      return this;
    };
    LayoutDockHelper.prototype.right = function(node, width, z) {
      if (width instanceof Array) {
        width = width[0];
      }
      if (node) {
        if (width === undefined) {
          var size = this._context.resolveSize(node, [this._right - this._left, this._bottom - this._top]);
          width = size[0];
        }
        this._context.set(node, {
          size: [width, this._bottom - this._top],
          origin: [1, 0],
          align: [1, 0],
          translate: [-(this._size[0] - this._right), this._top, (z === undefined) ? this._z : z]
        });
      }
      if (width) {
        this._right -= width;
      }
      return this;
    };
    LayoutDockHelper.prototype.fill = function(node, z) {
      this._context.set(node, {
        size: [this._right - this._left, this._bottom - this._top],
        translate: [this._left, this._top, (z === undefined) ? this._z : z]
      });
      return this;
    };
    LayoutDockHelper.prototype.margins = function(margins) {
      margins = LayoutUtility.normalizeMargins(margins);
      this._left += margins[3];
      this._top += margins[0];
      this._right -= margins[1];
      this._bottom -= margins[2];
      return this;
    };
    LayoutUtility.registerHelper('dock', LayoutDockHelper);
    module.exports = LayoutDockHelper;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("npm:famous@0.3.5/modifiers/StateModifier", ["npm:famous@0.3.5/core/Modifier", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/transitions/Transitionable", "npm:famous@0.3.5/transitions/TransitionableTransform"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Modifier = require("npm:famous@0.3.5/core/Modifier");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
  var TransitionableTransform = require("npm:famous@0.3.5/transitions/TransitionableTransform");
  function StateModifier(options) {
    this._transformState = new TransitionableTransform(Transform.identity);
    this._opacityState = new Transitionable(1);
    this._originState = new Transitionable([0, 0]);
    this._alignState = new Transitionable([0, 0]);
    this._sizeState = new Transitionable([0, 0]);
    this._proportionsState = new Transitionable([0, 0]);
    this._modifier = new Modifier({
      transform: this._transformState,
      opacity: this._opacityState,
      origin: null,
      align: null,
      size: null,
      proportions: null
    });
    this._hasOrigin = false;
    this._hasAlign = false;
    this._hasSize = false;
    this._hasProportions = false;
    if (options) {
      if (options.transform)
        this.setTransform(options.transform);
      if (options.opacity !== undefined)
        this.setOpacity(options.opacity);
      if (options.origin)
        this.setOrigin(options.origin);
      if (options.align)
        this.setAlign(options.align);
      if (options.size)
        this.setSize(options.size);
      if (options.proportions)
        this.setProportions(options.proportions);
    }
  }
  StateModifier.prototype.setTransform = function setTransform(transform, transition, callback) {
    this._transformState.set(transform, transition, callback);
    return this;
  };
  StateModifier.prototype.setOpacity = function setOpacity(opacity, transition, callback) {
    this._opacityState.set(opacity, transition, callback);
    return this;
  };
  StateModifier.prototype.setOrigin = function setOrigin(origin, transition, callback) {
    if (origin === null) {
      if (this._hasOrigin) {
        this._modifier.originFrom(null);
        this._hasOrigin = false;
      }
      return this;
    } else if (!this._hasOrigin) {
      this._hasOrigin = true;
      this._modifier.originFrom(this._originState);
    }
    this._originState.set(origin, transition, callback);
    return this;
  };
  StateModifier.prototype.setAlign = function setOrigin(align, transition, callback) {
    if (align === null) {
      if (this._hasAlign) {
        this._modifier.alignFrom(null);
        this._hasAlign = false;
      }
      return this;
    } else if (!this._hasAlign) {
      this._hasAlign = true;
      this._modifier.alignFrom(this._alignState);
    }
    this._alignState.set(align, transition, callback);
    return this;
  };
  StateModifier.prototype.setSize = function setSize(size, transition, callback) {
    if (size === null) {
      if (this._hasSize) {
        this._modifier.sizeFrom(null);
        this._hasSize = false;
      }
      return this;
    } else if (!this._hasSize) {
      this._hasSize = true;
      this._modifier.sizeFrom(this._sizeState);
    }
    this._sizeState.set(size, transition, callback);
    return this;
  };
  StateModifier.prototype.setProportions = function setSize(proportions, transition, callback) {
    if (proportions === null) {
      if (this._hasProportions) {
        this._modifier.proportionsFrom(null);
        this._hasProportions = false;
      }
      return this;
    } else if (!this._hasProportions) {
      this._hasProportions = true;
      this._modifier.proportionsFrom(this._proportionsState);
    }
    this._proportionsState.set(proportions, transition, callback);
    return this;
  };
  StateModifier.prototype.halt = function halt() {
    this._transformState.halt();
    this._opacityState.halt();
    this._originState.halt();
    this._alignState.halt();
    this._sizeState.halt();
    this._proportionsState.halt();
  };
  StateModifier.prototype.getTransform = function getTransform() {
    return this._transformState.get();
  };
  StateModifier.prototype.getFinalTransform = function getFinalTransform() {
    return this._transformState.getFinal();
  };
  StateModifier.prototype.getOpacity = function getOpacity() {
    return this._opacityState.get();
  };
  StateModifier.prototype.getOrigin = function getOrigin() {
    return this._hasOrigin ? this._originState.get() : null;
  };
  StateModifier.prototype.getAlign = function getAlign() {
    return this._hasAlign ? this._alignState.get() : null;
  };
  StateModifier.prototype.getSize = function getSize() {
    return this._hasSize ? this._sizeState.get() : null;
  };
  StateModifier.prototype.getProportions = function getProportions() {
    return this._hasProportions ? this._proportionsState.get() : null;
  };
  StateModifier.prototype.modify = function modify(target) {
    return this._modifier.modify(target);
  };
  module.exports = StateModifier;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/utilities/Timer", ["npm:famous@0.3.5/core/Engine"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var FamousEngine = require("npm:famous@0.3.5/core/Engine");
  var _event = 'prerender';
  var getTime = window.performance && window.performance.now ? function() {
    return window.performance.now();
  } : function() {
    return Date.now();
  };
  function addTimerFunction(fn) {
    FamousEngine.on(_event, fn);
    return fn;
  }
  function setTimeout(fn, duration) {
    var t = getTime();
    var callback = function() {
      var t2 = getTime();
      if (t2 - t >= duration) {
        fn.apply(this, arguments);
        FamousEngine.removeListener(_event, callback);
      }
    };
    return addTimerFunction(callback);
  }
  function setInterval(fn, duration) {
    var t = getTime();
    var callback = function() {
      var t2 = getTime();
      if (t2 - t >= duration) {
        fn.apply(this, arguments);
        t = getTime();
      }
    };
    return addTimerFunction(callback);
  }
  function after(fn, numTicks) {
    if (numTicks === undefined)
      return undefined;
    var callback = function() {
      numTicks--;
      if (numTicks <= 0) {
        fn.apply(this, arguments);
        clear(callback);
      }
    };
    return addTimerFunction(callback);
  }
  function every(fn, numTicks) {
    numTicks = numTicks || 1;
    var initial = numTicks;
    var callback = function() {
      numTicks--;
      if (numTicks <= 0) {
        fn.apply(this, arguments);
        numTicks = initial;
      }
    };
    return addTimerFunction(callback);
  }
  function clear(fn) {
    FamousEngine.removeListener(_event, fn);
  }
  function debounce(func, wait) {
    var timeout;
    var ctx;
    var timestamp;
    var result;
    var args;
    return function() {
      ctx = this;
      args = arguments;
      timestamp = getTime();
      var fn = function() {
        var last = getTime - timestamp;
        if (last < wait) {
          timeout = setTimeout(fn, wait - last);
        } else {
          timeout = null;
          result = func.apply(ctx, args);
        }
      };
      clear(timeout);
      timeout = setTimeout(fn, wait);
      return result;
    };
  }
  module.exports = {
    setTimeout: setTimeout,
    setInterval: setInterval,
    debounce: debounce,
    after: after,
    every: every,
    clear: clear
  };
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/transitions/Easing", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Easing = {
    inQuad: function(t) {
      return t * t;
    },
    outQuad: function(t) {
      return -(t -= 1) * t + 1;
    },
    inOutQuad: function(t) {
      if ((t /= 0.5) < 1)
        return 0.5 * t * t;
      return -0.5 * (--t * (t - 2) - 1);
    },
    inCubic: function(t) {
      return t * t * t;
    },
    outCubic: function(t) {
      return --t * t * t + 1;
    },
    inOutCubic: function(t) {
      if ((t /= 0.5) < 1)
        return 0.5 * t * t * t;
      return 0.5 * ((t -= 2) * t * t + 2);
    },
    inQuart: function(t) {
      return t * t * t * t;
    },
    outQuart: function(t) {
      return -(--t * t * t * t - 1);
    },
    inOutQuart: function(t) {
      if ((t /= 0.5) < 1)
        return 0.5 * t * t * t * t;
      return -0.5 * ((t -= 2) * t * t * t - 2);
    },
    inQuint: function(t) {
      return t * t * t * t * t;
    },
    outQuint: function(t) {
      return --t * t * t * t * t + 1;
    },
    inOutQuint: function(t) {
      if ((t /= 0.5) < 1)
        return 0.5 * t * t * t * t * t;
      return 0.5 * ((t -= 2) * t * t * t * t + 2);
    },
    inSine: function(t) {
      return -1 * Math.cos(t * (Math.PI / 2)) + 1;
    },
    outSine: function(t) {
      return Math.sin(t * (Math.PI / 2));
    },
    inOutSine: function(t) {
      return -0.5 * (Math.cos(Math.PI * t) - 1);
    },
    inExpo: function(t) {
      return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    },
    outExpo: function(t) {
      return t === 1 ? 1 : -Math.pow(2, -10 * t) + 1;
    },
    inOutExpo: function(t) {
      if (t === 0)
        return 0;
      if (t === 1)
        return 1;
      if ((t /= 0.5) < 1)
        return 0.5 * Math.pow(2, 10 * (t - 1));
      return 0.5 * (-Math.pow(2, -10 * --t) + 2);
    },
    inCirc: function(t) {
      return -(Math.sqrt(1 - t * t) - 1);
    },
    outCirc: function(t) {
      return Math.sqrt(1 - --t * t);
    },
    inOutCirc: function(t) {
      if ((t /= 0.5) < 1)
        return -0.5 * (Math.sqrt(1 - t * t) - 1);
      return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
    },
    inElastic: function(t) {
      var s = 1.70158;
      var p = 0;
      var a = 1;
      if (t === 0)
        return 0;
      if (t === 1)
        return 1;
      if (!p)
        p = 0.3;
      s = p / (2 * Math.PI) * Math.asin(1 / a);
      return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p));
    },
    outElastic: function(t) {
      var s = 1.70158;
      var p = 0;
      var a = 1;
      if (t === 0)
        return 0;
      if (t === 1)
        return 1;
      if (!p)
        p = 0.3;
      s = p / (2 * Math.PI) * Math.asin(1 / a);
      return a * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
    },
    inOutElastic: function(t) {
      var s = 1.70158;
      var p = 0;
      var a = 1;
      if (t === 0)
        return 0;
      if ((t /= 0.5) === 2)
        return 1;
      if (!p)
        p = 0.3 * 1.5;
      s = p / (2 * Math.PI) * Math.asin(1 / a);
      if (t < 1)
        return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p));
      return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p) * 0.5 + 1;
    },
    inBack: function(t, s) {
      if (s === undefined)
        s = 1.70158;
      return t * t * ((s + 1) * t - s);
    },
    outBack: function(t, s) {
      if (s === undefined)
        s = 1.70158;
      return --t * t * ((s + 1) * t + s) + 1;
    },
    inOutBack: function(t, s) {
      if (s === undefined)
        s = 1.70158;
      if ((t /= 0.5) < 1)
        return 0.5 * (t * t * (((s *= 1.525) + 1) * t - s));
      return 0.5 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2);
    },
    inBounce: function(t) {
      return 1 - Easing.outBounce(1 - t);
    },
    outBounce: function(t) {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    },
    inOutBounce: function(t) {
      if (t < 0.5)
        return Easing.inBounce(t * 2) * 0.5;
      return Easing.outBounce(t * 2 - 1) * 0.5 + 0.5;
    }
  };
  module.exports = Easing;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface", ["npm:famous@0.3.5/core/Surface"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    'use strict';
    var Surface = require("npm:famous@0.3.5/core/Surface");
    var SizeMode = {
      AUTO: 'auto',
      FILL: '100% 100%',
      ASPECTFILL: 'cover',
      ASPECTFIT: 'contain'
    };
    var PositionMode = {
      CENTER: 'center center',
      LEFT: 'left center',
      RIGHT: 'right center',
      TOP: 'center top',
      BOTTOM: 'center bottom',
      TOPLEFT: 'left top',
      TOPRIGHT: 'right top',
      BOTTOMLEFT: 'left bottom',
      BOTTOMRIGHT: 'right bottom'
    };
    var RepeatMode = {
      NONE: 'no-repeat',
      VERTICAL: 'repeat-x',
      HORIZONTAL: 'repeat-y',
      BOTH: 'repeat'
    };
    function BkImageSurface(options) {
      Surface.apply(this, arguments);
      this.content = undefined;
      this._imageUrl = options ? options.content : undefined;
      this._sizeMode = (options && options.sizeMode) ? options.sizeMode : SizeMode.FILL;
      this._positionMode = (options && options.positionMode) ? options.positionMode : PositionMode.CENTER;
      this._repeatMode = (options && options.repeatMode) ? options.repeatMode : RepeatMode.NONE;
      this._updateProperties();
    }
    BkImageSurface.prototype = Object.create(Surface.prototype);
    BkImageSurface.prototype.constructor = BkImageSurface;
    BkImageSurface.prototype.elementType = 'div';
    BkImageSurface.prototype.elementClass = 'famous-surface';
    BkImageSurface.SizeMode = SizeMode;
    BkImageSurface.PositionMode = PositionMode;
    BkImageSurface.RepeatMode = RepeatMode;
    BkImageSurface.prototype._updateProperties = function() {
      var props = this.getProperties();
      if (this._imageUrl) {
        var imageUrl = this._imageUrl;
        if ((imageUrl.indexOf('(') >= 0) || (imageUrl.indexOf(')') >= 0)) {
          imageUrl = imageUrl.split('(').join('%28');
          imageUrl = imageUrl.split(')').join('%29');
        }
        props.backgroundImage = 'url(' + imageUrl + ')';
      } else {
        props.backgroundImage = '';
      }
      props.backgroundSize = this._sizeMode;
      props.backgroundPosition = this._positionMode;
      props.backgroundRepeat = this._repeatMode;
      this.setProperties(props);
    };
    BkImageSurface.prototype.setContent = function(imageUrl) {
      this._imageUrl = imageUrl;
      this._updateProperties();
    };
    BkImageSurface.prototype.getContent = function() {
      return this._imageUrl;
    };
    BkImageSurface.prototype.setSizeMode = function(sizeMode) {
      this._sizeMode = sizeMode;
      this._updateProperties();
    };
    BkImageSurface.prototype.getSizeMode = function() {
      return this._sizeMode;
    };
    BkImageSurface.prototype.setPositionMode = function(positionMode) {
      this._positionMode = positionMode;
      this._updateProperties();
    };
    BkImageSurface.prototype.getPositionMode = function() {
      return this._positionMode;
    };
    BkImageSurface.prototype.setRepeatMode = function(repeatMode) {
      this._repeatMode = repeatMode;
      this._updateProperties();
    };
    BkImageSurface.prototype.getRepeatMode = function() {
      return this._repeatMode;
    };
    BkImageSurface.prototype.deploy = function deploy(target) {
      target.innerHTML = '';
      if (this._imageUrl) {
        target.style.backgroundImage = 'url(' + this._imageUrl + ')';
      }
    };
    BkImageSurface.prototype.recall = function recall(target) {
      target.style.backgroundImage = '';
    };
    module.exports = BkImageSurface;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("views/FullImageView", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/View", "utils/objectHelper", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface"], function($__export) {
  "use strict";
  var __moduleName = "views/FullImageView";
  var Engine,
      Surface,
      View,
      ObjectHelper,
      LayoutController,
      BkImageSurface,
      DEFAULT_OPTIONS,
      FullImageView;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      BkImageSurface = $__m.default;
    }],
    execute: function() {
      DEFAULT_OPTIONS = {
        classes: ['view', 'fullImage'],
        margins: [20, 20, 20, 20],
        textHeight: 30
      };
      FullImageView = $__export("FullImageView", (function($__super) {
        var FullImageView = function FullImageView() {
          $traceurRuntime.superConstructor(FullImageView).call(this, DEFAULT_OPTIONS);
          ObjectHelper.bindAllMethods(this, this);
          ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
          ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');
          this._createRenderables();
          this._createLayout();
        };
        return ($traceurRuntime.createClass)(FullImageView, {
          _createRenderables: function() {
            this._renderables = {
              background: new Surface({classes: this.options.classes.concat(['background'])}),
              image: new BkImageSurface({
                classes: this.options.classes.concat(['image']),
                content: 'img/scarlett.jpg',
                sizeMode: 'cover'
              }),
              text: new Surface({
                classes: this.options.classes.concat(['text']),
                content: this.options.text
              })
            };
          },
          _createLayout: function() {
            this.layout = new LayoutController({
              autoPipeEvents: true,
              layout: function(context, options) {
                context.set('background', {size: context.size});
                var imageSize = [context.size[0] - this.options.margins[1] - this.options.margins[3], context.size[1] - this.options.margins[0] - this.options.margins[2]];
                if (imageSize[0] > imageSize[1]) {
                  imageSize[0] = imageSize[1];
                } else {
                  imageSize[1] = imageSize[0];
                }
                context.set('image', {
                  size: imageSize,
                  translate: [(context.size[0] - imageSize[0]) / 2, (context.size[1] - imageSize[1]) / 2, 1]
                });
                context.set('text', {
                  size: [context.size[0], this.options.textHeight],
                  translate: [0, context.size[1] - this.options.textHeight, 1]
                });
              }.bind(this),
              dataSource: this._renderables
            });
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
          }
        }, {}, $__super);
      }(View)));
    }
  };
});



System.register("views/NavBarView", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/View", "utils/objectHelper", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-flex@0.3.1/src/helpers/LayoutDockHelper", "github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface"], function($__export) {
  "use strict";
  var __moduleName = "views/NavBarView";
  var Engine,
      Surface,
      View,
      ObjectHelper,
      LayoutController,
      LayoutDockHelper,
      BkImageSurface,
      DEFAULT_OPTIONS,
      NavBarView;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      LayoutDockHelper = $__m.default;
    }, function($__m) {
      BkImageSurface = $__m.default;
    }],
    execute: function() {
      DEFAULT_OPTIONS = {
        classes: ['view', 'profile'],
        navBar: {
          height: 50,
          left: false
        },
        profileText: 'Scarlett Johansson was born in New York City. Her mother, Melanie Sloan, is from an Ashkenazi Jewish family, and her father, Karsten Johansson, is Danish. Scarlett showed a passion for acting at a young age and starred in many plays.<br><br>She has a sister named Vanessa Johansson, a brother named Adrian, and a twin brother named Hunter Johansson born three minutes after her. She began her acting career starring as Laura Nelson in the comedy film North (1994).<br><br>The acclaimed drama film The Horse Whisperer (1998) brought Johansson critical praise and worldwide recognition. Following the film\'s success, she starred in many other films including the critically acclaimed cult film Ghost World (2001) and then the hit Lost in Translation (2003) with Bill Murray in which she again stunned critics. Later on, she appeared in the drama film Girl with a Pearl Earring (2003).'
      };
      NavBarView = $__export("NavBarView", (function($__super) {
        var NavBarView = function NavBarView() {
          $traceurRuntime.superConstructor(NavBarView).call(this, DEFAULT_OPTIONS);
          ObjectHelper.bindAllMethods(this, this);
          ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
          ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');
          this._createRenderables();
          this._createLayout();
        };
        return ($traceurRuntime.createClass)(NavBarView, {
          _createRenderables: function() {
            this._renderables = {
              background: new Surface({classes: this.options.classes.concat(['background'])}),
              navBarBackground: new Surface({classes: this.options.classes.concat(['navbar', 'background'])}),
              navBarTitle: new Surface({
                classes: this.options.classes.concat(['navbar', 'title']),
                content: '<div>' + 'Scarlett Johansson' + '</div>'
              }),
              navBarImage: new BkImageSurface({
                classes: this.options.classes.concat(['navbar', 'image']),
                content: 'img/scarlett.jpg',
                sizeMode: 'cover'
              }),
              content: new Surface({
                classes: this.options.classes.concat(['text']),
                content: this.options.profileText
              })
            };
          },
          _createLayout: function() {
            this.layout = new LayoutController({
              autoPipeEvents: true,
              layout: function(context, options) {
                var dock = new LayoutDockHelper(context, options);
                dock.fill('background');
                dock.top('navBarBackground', this.options.navBar.height, 1);
                context.set('navBarTitle', {
                  size: [context.size[0], this.options.navBar.height],
                  translate: [0, 0, 2]
                });
                context.set('navBarImage', {
                  size: [32, 32],
                  translate: [this.options.left ? 20 : (context.size[0] - 20 - 32), 9, 2]
                });
                dock.top(undefined, 20);
                dock.fill('content', 1);
              }.bind(this),
              dataSource: this._renderables
            });
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
          }
        }, {}, $__super);
      }(View)));
    }
  };
});



System.register("npm:famous@0.3.5/surfaces/ContainerSurface", ["npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/Context"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Surface = require("npm:famous@0.3.5/core/Surface");
  var Context = require("npm:famous@0.3.5/core/Context");
  function ContainerSurface(options) {
    Surface.call(this, options);
    this._container = document.createElement('div');
    this._container.classList.add('famous-group');
    this._container.classList.add('famous-container-group');
    this._shouldRecalculateSize = false;
    this.context = new Context(this._container);
    this.setContent(this._container);
  }
  ContainerSurface.prototype = Object.create(Surface.prototype);
  ContainerSurface.prototype.constructor = ContainerSurface;
  ContainerSurface.prototype.elementType = 'div';
  ContainerSurface.prototype.elementClass = 'famous-surface';
  ContainerSurface.prototype.add = function add() {
    return this.context.add.apply(this.context, arguments);
  };
  ContainerSurface.prototype.render = function render() {
    if (this._sizeDirty)
      this._shouldRecalculateSize = true;
    return Surface.prototype.render.apply(this, arguments);
  };
  ContainerSurface.prototype.deploy = function deploy() {
    this._shouldRecalculateSize = true;
    return Surface.prototype.deploy.apply(this, arguments);
  };
  ContainerSurface.prototype.commit = function commit(context, transform, opacity, origin, size) {
    var previousSize = this._size ? [this._size[0], this._size[1]] : null;
    var result = Surface.prototype.commit.apply(this, arguments);
    if (this._shouldRecalculateSize || previousSize && (this._size[0] !== previousSize[0] || this._size[1] !== previousSize[1])) {
      this.context.setSize();
      this._shouldRecalculateSize = false;
    }
    this.context.update();
    return result;
  };
  module.exports = ContainerSurface;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Group", ["npm:famous@0.3.5/core/Context", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/core/Surface"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Context = require("npm:famous@0.3.5/core/Context");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Surface = require("npm:famous@0.3.5/core/Surface");
  function Group(options) {
    Surface.call(this, options);
    this._shouldRecalculateSize = false;
    this._container = document.createDocumentFragment();
    this.context = new Context(this._container);
    this.setContent(this._container);
    this._groupSize = [undefined, undefined];
  }
  Group.SIZE_ZERO = [0, 0];
  Group.prototype = Object.create(Surface.prototype);
  Group.prototype.elementType = 'div';
  Group.prototype.elementClass = 'famous-group';
  Group.prototype.add = function add() {
    return this.context.add.apply(this.context, arguments);
  };
  Group.prototype.render = function render() {
    return Surface.prototype.render.call(this);
  };
  Group.prototype.deploy = function deploy(target) {
    this.context.migrate(target);
  };
  Group.prototype.recall = function recall(target) {
    this._container = document.createDocumentFragment();
    this.context.migrate(this._container);
  };
  Group.prototype.commit = function commit(context) {
    var transform = context.transform;
    var origin = context.origin;
    var opacity = context.opacity;
    var size = context.size;
    var result = Surface.prototype.commit.call(this, {
      allocator: context.allocator,
      transform: Transform.thenMove(transform, [-origin[0] * size[0], -origin[1] * size[1], 0]),
      opacity: opacity,
      origin: origin,
      size: Group.SIZE_ZERO
    });
    if (size[0] !== this._groupSize[0] || size[1] !== this._groupSize[1]) {
      this._groupSize[0] = size[0];
      this._groupSize[1] = size[1];
      this.context.setSize(size);
    }
    this.context.update({
      transform: Transform.translate(-origin[0] * size[0], -origin[1] * size[1], 0),
      origin: origin,
      size: size
    });
    return result;
  };
  module.exports = Group;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/physics/forces/Drag", ["npm:famous@0.3.5/physics/forces/Force"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Force = require("npm:famous@0.3.5/physics/forces/Force");
  function Drag(options) {
    this.options = Object.create(this.constructor.DEFAULT_OPTIONS);
    if (options)
      this.setOptions(options);
    Force.call(this);
  }
  Drag.prototype = Object.create(Force.prototype);
  Drag.prototype.constructor = Drag;
  Drag.FORCE_FUNCTIONS = {
    LINEAR: function(velocity) {
      return velocity;
    },
    QUADRATIC: function(velocity) {
      return velocity.mult(velocity.norm());
    }
  };
  Drag.DEFAULT_OPTIONS = {
    strength: 0.01,
    forceFunction: Drag.FORCE_FUNCTIONS.LINEAR
  };
  Drag.prototype.applyForce = function applyForce(targets) {
    var strength = this.options.strength;
    var forceFunction = this.options.forceFunction;
    var force = this.force;
    var index;
    var particle;
    for (index = 0; index < targets.length; index++) {
      particle = targets[index];
      forceFunction(particle.velocity).mult(-strength).put(force);
      particle.applyForce(force);
    }
  };
  Drag.prototype.setOptions = function setOptions(options) {
    for (var key in options)
      this.options[key] = options[key];
  };
  module.exports = Drag;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/inputs/ScrollSync", ["npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/OptionsManager"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  var Engine = require("npm:famous@0.3.5/core/Engine");
  var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
  function ScrollSync(options) {
    this.options = Object.create(ScrollSync.DEFAULT_OPTIONS);
    this._optionsManager = new OptionsManager(this.options);
    if (options)
      this.setOptions(options);
    this._payload = {
      delta: null,
      position: null,
      velocity: null,
      slip: true
    };
    this._eventInput = new EventHandler();
    this._eventOutput = new EventHandler();
    EventHandler.setInputHandler(this, this._eventInput);
    EventHandler.setOutputHandler(this, this._eventOutput);
    this._position = this.options.direction === undefined ? [0, 0] : 0;
    this._prevTime = undefined;
    this._prevVel = undefined;
    this._eventInput.on('mousewheel', _handleMove.bind(this));
    this._eventInput.on('wheel', _handleMove.bind(this));
    this._inProgress = false;
    this._loopBound = false;
  }
  ScrollSync.DEFAULT_OPTIONS = {
    direction: undefined,
    minimumEndSpeed: Infinity,
    rails: false,
    scale: 1,
    stallTime: 50,
    lineHeight: 40,
    preventDefault: true
  };
  ScrollSync.DIRECTION_X = 0;
  ScrollSync.DIRECTION_Y = 1;
  var MINIMUM_TICK_TIME = 8;
  var _now = Date.now;
  function _newFrame() {
    if (this._inProgress && _now() - this._prevTime > this.options.stallTime) {
      this._inProgress = false;
      var finalVel = Math.abs(this._prevVel) >= this.options.minimumEndSpeed ? this._prevVel : 0;
      var payload = this._payload;
      payload.position = this._position;
      payload.velocity = finalVel;
      payload.slip = true;
      this._eventOutput.emit('end', payload);
    }
  }
  function _handleMove(event) {
    if (this.options.preventDefault)
      event.preventDefault();
    if (!this._inProgress) {
      this._inProgress = true;
      this._position = this.options.direction === undefined ? [0, 0] : 0;
      payload = this._payload;
      payload.slip = true;
      payload.position = this._position;
      payload.clientX = event.clientX;
      payload.clientY = event.clientY;
      payload.offsetX = event.offsetX;
      payload.offsetY = event.offsetY;
      this._eventOutput.emit('start', payload);
      if (!this._loopBound) {
        Engine.on('prerender', _newFrame.bind(this));
        this._loopBound = true;
      }
    }
    var currTime = _now();
    var prevTime = this._prevTime || currTime;
    var diffX = event.wheelDeltaX !== undefined ? event.wheelDeltaX : -event.deltaX;
    var diffY = event.wheelDeltaY !== undefined ? event.wheelDeltaY : -event.deltaY;
    if (event.deltaMode === 1) {
      diffX *= this.options.lineHeight;
      diffY *= this.options.lineHeight;
    }
    if (this.options.rails) {
      if (Math.abs(diffX) > Math.abs(diffY))
        diffY = 0;
      else
        diffX = 0;
    }
    var diffTime = Math.max(currTime - prevTime, MINIMUM_TICK_TIME);
    var velX = diffX / diffTime;
    var velY = diffY / diffTime;
    var scale = this.options.scale;
    var nextVel;
    var nextDelta;
    if (this.options.direction === ScrollSync.DIRECTION_X) {
      nextDelta = scale * diffX;
      nextVel = scale * velX;
      this._position += nextDelta;
    } else if (this.options.direction === ScrollSync.DIRECTION_Y) {
      nextDelta = scale * diffY;
      nextVel = scale * velY;
      this._position += nextDelta;
    } else {
      nextDelta = [scale * diffX, scale * diffY];
      nextVel = [scale * velX, scale * velY];
      this._position[0] += nextDelta[0];
      this._position[1] += nextDelta[1];
    }
    var payload = this._payload;
    payload.delta = nextDelta;
    payload.velocity = nextVel;
    payload.position = this._position;
    payload.slip = true;
    this._eventOutput.emit('update', payload);
    this._prevTime = currTime;
    this._prevVel = nextVel;
  }
  ScrollSync.prototype.getOptions = function getOptions() {
    return this.options;
  };
  ScrollSync.prototype.setOptions = function setOptions(options) {
    return this._optionsManager.setOptions(options);
  };
  module.exports = ScrollSync;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/layouts/ListLayout", ["npm:famous@0.3.5/utilities/Utility", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Utility = require("npm:famous@0.3.5/utilities/Utility");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    var capabilities = {
      sequence: true,
      direction: [Utility.Direction.Y, Utility.Direction.X],
      scrolling: true,
      trueSize: true,
      sequentialScrollingOptimized: true
    };
    var set = {
      size: [0, 0],
      translate: [0, 0, 0],
      scrollLength: undefined
    };
    var margin = [0, 0];
    function ListLayout(context, options) {
      var size = context.size;
      var direction = context.direction;
      var alignment = context.alignment;
      var revDirection = direction ? 0 : 1;
      var offset;
      var margins = LayoutUtility.normalizeMargins(options.margins);
      var spacing = options.spacing || 0;
      var node;
      var nodeSize;
      var itemSize;
      var getItemSize;
      var lastSectionBeforeVisibleCell;
      var lastSectionBeforeVisibleCellOffset;
      var lastSectionBeforeVisibleCellLength;
      var lastSectionBeforeVisibleCellScrollLength;
      var lastSectionBeforeVisibleCellTopReached;
      var firstVisibleCell;
      var lastNode;
      var lastCellOffsetInFirstVisibleSection;
      var isSectionCallback = options.isSectionCallback;
      var bound;
      set.size[0] = size[0];
      set.size[1] = size[1];
      set.size[revDirection] -= (margins[1 - revDirection] + margins[3 - revDirection]);
      set.translate[0] = 0;
      set.translate[1] = 0;
      set.translate[2] = 0;
      set.translate[revDirection] = margins[direction ? 3 : 0];
      if ((options.itemSize === true) || !options.hasOwnProperty('itemSize')) {
        itemSize = true;
      } else if (options.itemSize instanceof Function) {
        getItemSize = options.itemSize;
      } else {
        itemSize = (options.itemSize === undefined) ? size[direction] : options.itemSize;
      }
      margin[0] = margins[direction ? 0 : 3];
      margin[1] = -margins[direction ? 2 : 1];
      offset = context.scrollOffset + margin[alignment];
      bound = context.scrollEnd + margin[alignment];
      while (offset < (bound + spacing)) {
        lastNode = node;
        node = context.next();
        if (!node) {
          break;
        }
        nodeSize = getItemSize ? getItemSize(node.renderNode) : itemSize;
        nodeSize = (nodeSize === true) ? context.resolveSize(node, size)[direction] : nodeSize;
        set.size[direction] = nodeSize;
        set.translate[direction] = offset + (alignment ? spacing : 0);
        set.scrollLength = nodeSize + spacing;
        context.set(node, set);
        offset += set.scrollLength;
        if (isSectionCallback && isSectionCallback(node.renderNode)) {
          if ((set.translate[direction] <= margin[0]) && !lastSectionBeforeVisibleCellTopReached) {
            lastSectionBeforeVisibleCellTopReached = true;
            set.translate[direction] = margin[0];
            context.set(node, set);
          }
          if (!firstVisibleCell) {
            lastSectionBeforeVisibleCell = node;
            lastSectionBeforeVisibleCellOffset = offset - nodeSize;
            lastSectionBeforeVisibleCellLength = nodeSize;
            lastSectionBeforeVisibleCellScrollLength = nodeSize;
          } else if (lastCellOffsetInFirstVisibleSection === undefined) {
            lastCellOffsetInFirstVisibleSection = offset - nodeSize;
          }
        } else if (!firstVisibleCell && (offset >= 0)) {
          firstVisibleCell = node;
        }
      }
      if (lastNode && !node && !alignment) {
        set.scrollLength = nodeSize + margin[0] + -margin[1];
        context.set(lastNode, set);
      }
      lastNode = undefined;
      node = undefined;
      offset = context.scrollOffset + margin[alignment];
      bound = context.scrollStart + margin[alignment];
      while (offset > (bound - spacing)) {
        lastNode = node;
        node = context.prev();
        if (!node) {
          break;
        }
        nodeSize = getItemSize ? getItemSize(node.renderNode) : itemSize;
        nodeSize = (nodeSize === true) ? context.resolveSize(node, size)[direction] : nodeSize;
        set.scrollLength = nodeSize + spacing;
        offset -= set.scrollLength;
        set.size[direction] = nodeSize;
        set.translate[direction] = offset + (alignment ? spacing : 0);
        context.set(node, set);
        if (isSectionCallback && isSectionCallback(node.renderNode)) {
          if ((set.translate[direction] <= margin[0]) && !lastSectionBeforeVisibleCellTopReached) {
            lastSectionBeforeVisibleCellTopReached = true;
            set.translate[direction] = margin[0];
            context.set(node, set);
          }
          if (!lastSectionBeforeVisibleCell) {
            lastSectionBeforeVisibleCell = node;
            lastSectionBeforeVisibleCellOffset = offset;
            lastSectionBeforeVisibleCellLength = nodeSize;
            lastSectionBeforeVisibleCellScrollLength = set.scrollLength;
          }
        } else if ((offset + nodeSize) >= 0) {
          firstVisibleCell = node;
          if (lastSectionBeforeVisibleCell) {
            lastCellOffsetInFirstVisibleSection = offset + nodeSize;
          }
          lastSectionBeforeVisibleCell = undefined;
        }
      }
      if (lastNode && !node && alignment) {
        set.scrollLength = nodeSize + margin[0] + -margin[1];
        context.set(lastNode, set);
        if (lastSectionBeforeVisibleCell === lastNode) {
          lastSectionBeforeVisibleCellScrollLength = set.scrollLength;
        }
      }
      if (isSectionCallback && !lastSectionBeforeVisibleCell) {
        node = context.prev();
        while (node) {
          if (isSectionCallback(node.renderNode)) {
            lastSectionBeforeVisibleCell = node;
            nodeSize = options.itemSize || context.resolveSize(node, size)[direction];
            lastSectionBeforeVisibleCellOffset = offset - nodeSize;
            lastSectionBeforeVisibleCellLength = nodeSize;
            lastSectionBeforeVisibleCellScrollLength = undefined;
            break;
          } else {
            node = context.prev();
          }
        }
      }
      if (lastSectionBeforeVisibleCell) {
        var correctedOffset = Math.max(margin[0], lastSectionBeforeVisibleCellOffset);
        if ((lastCellOffsetInFirstVisibleSection !== undefined) && (lastSectionBeforeVisibleCellLength > (lastCellOffsetInFirstVisibleSection - margin[0]))) {
          correctedOffset = ((lastCellOffsetInFirstVisibleSection - lastSectionBeforeVisibleCellLength));
        }
        set.size[direction] = lastSectionBeforeVisibleCellLength;
        set.translate[direction] = correctedOffset;
        set.scrollLength = lastSectionBeforeVisibleCellScrollLength;
        context.set(lastSectionBeforeVisibleCell, set);
      }
    }
    ListLayout.Capabilities = capabilities;
    ListLayout.Name = 'ListLayout';
    ListLayout.Description = 'List-layout with margins, spacing and sticky headers';
    module.exports = ListLayout;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("views/NewChupsView", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/View", "utils/objectHelper", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface"], function($__export) {
  "use strict";
  var __moduleName = "views/NewChupsView";
  var Engine,
      Surface,
      View,
      ObjectHelper,
      LayoutController,
      BkImageSurface,
      DEFAULT_OPTIONS,
      NewChupsView;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      BkImageSurface = $__m.default;
    }],
    execute: function() {
      DEFAULT_OPTIONS = {margin: 10};
      NewChupsView = $__export("NewChupsView", (function($__super) {
        var NewChupsView = function NewChupsView() {
          $traceurRuntime.superConstructor(NewChupsView).call(this, DEFAULT_OPTIONS);
          ObjectHelper.bindAllMethods(this, this);
          ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
          ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');
          this._createRenderables();
          this._createLayout();
        };
        return ($traceurRuntime.createClass)(NewChupsView, {
          _createRenderables: function() {
            this._renderables = {
              infopanel: new BkImageSurface({
                content: 'img/sf0.jpg',
                sizeMode: 'cover'
              }),
              topleft: new BkImageSurface({
                content: 'img/sf1.jpg',
                sizeMode: 'cover',
                properties: {id: 1}
              }),
              topright: new BkImageSurface({
                content: 'img/sf2.jpg',
                sizeMode: 'cover',
                properties: {id: 2}
              }),
              bottomleft: new BkImageSurface({
                content: 'img/sf3.jpg',
                sizeMode: 'cover',
                properties: {id: 3}
              }),
              bottomright: new BkImageSurface({
                content: 'img/sf4.jpg',
                sizeMode: 'cover',
                properties: {id: 4}
              })
            };
            var self = this;
            this._renderables.topleft.on('click', function() {
              var id = this.properties.id;
              self._eventOutput.emit('play', id);
            });
            this._renderables.topright.on('click', function() {
              var id = this.properties.id;
              self._eventOutput.emit('play', id);
            });
            this._renderables.bottomleft.on('click', function() {
              var id = this.properties.id;
              self._eventOutput.emit('play', id);
            });
            this._renderables.bottomright.on('click', function() {
              var id = this.properties.id;
              self._eventOutput.emit('play', id);
            });
          },
          _createLayout: function() {
            this.layout = new LayoutController({
              autoPipeEvents: true,
              layout: function(context, options) {
                var infoPanelSize = [context.size[0], context.size[1] * 0.2];
                var centre = context.size[0] / 2;
                var imgSize = [centre - (this.options.margin * 2), centre - (this.options.margin * 2)];
                context.set('infopanel', {size: infoPanelSize});
                context.set('topleft', {
                  size: imgSize,
                  translate: [this.options.margin * 2, (context.size[1] * 0.2) + this.options.margin, 1]
                });
                context.set('topright', {
                  size: imgSize,
                  translate: [centre, (context.size[1] * 0.2) + this.options.margin, 1]
                });
                context.set('bottomleft', {
                  size: imgSize,
                  translate: [this.options.margin * 2, (context.size[1] * 0.2) + centre, 1]
                });
                context.set('bottomright', {
                  size: imgSize,
                  translate: [centre, (context.size[1] * 0.2) + centre, 1]
                });
              }.bind(this),
              dataSource: this._renderables
            });
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
          }
        }, {}, $__super);
      }(View)));
    }
  };
});



System.register("npm:famous@0.3.5/views/Flipper", ["npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/transitions/Transitionable", "npm:famous@0.3.5/core/RenderNode", "npm:famous@0.3.5/core/OptionsManager"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
  var RenderNode = require("npm:famous@0.3.5/core/RenderNode");
  var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
  function Flipper(options) {
    this.options = Object.create(Flipper.DEFAULT_OPTIONS);
    this._optionsManager = new OptionsManager(this.options);
    if (options)
      this.setOptions(options);
    this.angle = new Transitionable(0);
    this.frontNode = undefined;
    this.backNode = undefined;
    this.flipped = false;
  }
  Flipper.DIRECTION_X = 0;
  Flipper.DIRECTION_Y = 1;
  var SEPERATION_LENGTH = 1;
  Flipper.DEFAULT_OPTIONS = {
    transition: true,
    direction: Flipper.DIRECTION_X
  };
  Flipper.prototype.flip = function flip(transition, callback) {
    var angle = this.flipped ? 0 : Math.PI;
    this.setAngle(angle, transition, callback);
    this.flipped = !this.flipped;
  };
  Flipper.prototype.setAngle = function setAngle(angle, transition, callback) {
    if (transition === undefined)
      transition = this.options.transition;
    if (this.angle.isActive())
      this.angle.halt();
    this.angle.set(angle, transition, callback);
  };
  Flipper.prototype.setOptions = function setOptions(options) {
    return this._optionsManager.setOptions(options);
  };
  Flipper.prototype.setFront = function setFront(node) {
    this.frontNode = node;
  };
  Flipper.prototype.setBack = function setBack(node) {
    this.backNode = node;
  };
  Flipper.prototype.render = function render() {
    var angle = this.angle.get();
    var frontTransform;
    var backTransform;
    if (this.options.direction === Flipper.DIRECTION_X) {
      frontTransform = Transform.rotateY(angle);
      backTransform = Transform.rotateY(angle + Math.PI);
    } else {
      frontTransform = Transform.rotateX(angle);
      backTransform = Transform.rotateX(angle + Math.PI);
    }
    var result = [];
    if (this.frontNode) {
      result.push({
        transform: frontTransform,
        target: this.frontNode.render()
      });
    }
    if (this.backNode) {
      result.push({
        transform: Transform.moveThen([0, 0, SEPERATION_LENGTH], backTransform),
        target: this.backNode.render()
      });
    }
    return result;
  };
  module.exports = Flipper;
  global.define = __define;
  return module.exports;
});



System.register("controllers/PlayController", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "core/Controller", "views/ProfileView", "views/FullImageView", "views/NavBarView", "views/ChupPlayView", "views/NewChupsView", "npm:famous@0.3.5/transitions/Easing", "github:ijzerenhein/famous-flex@0.3.1/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "controllers/PlayController";
  var Engine,
      Surface,
      Controller,
      ProfileView,
      FullImageView,
      NavBarView,
      ChupPlayView,
      NewChupsView,
      Easing,
      AnimationController;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      Controller = $__m.Controller;
    }, function($__m) {
      ProfileView = $__m.ProfileView;
    }, function($__m) {
      FullImageView = $__m.FullImageView;
    }, function($__m) {
      NavBarView = $__m.NavBarView;
    }, function($__m) {
      ChupPlayView = $__m.ChupPlayView;
    }, function($__m) {
      NewChupsView = $__m.NewChupsView;
    }, function($__m) {
      Easing = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      $__export('default', (function($__super) {
        var PlayController = function PlayController(router, context) {
          $traceurRuntime.superConstructor(PlayController).call(this, router, context, {transfer: {
              transition: {
                duration: 200,
                curve: Easing.inQuad
              },
              zIndex: 1000,
              items: {
                'topleft': ['topleft', 'chupheader1'],
                'topright': ['topright', 'chupheader2'],
                'bottomleft': ['bottomleft', 'chupheader3'],
                'bottomright': ['bottomright', 'chupheader4'],
                'chupheader1': ['topleft', 'chupheader1'],
                'chupheader2': ['topright', 'chupheader2'],
                'chupheader3': ['bottomleft', 'chupheader3'],
                'chupheader4': ['bottomright', 'chupheader4']
              }
            }});
          this.on('renderend', (function(arg) {
            console.log(arg);
          }));
        };
        return ($traceurRuntime.createClass)(PlayController, {Chup: function(id) {
            return new ChupPlayView(id);
          }}, {}, $__super);
      }(Controller)));
    }
  };
});



System.register("github:Bizboard/arva-ds@master/core/DataSource", [], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/arva-ds@master/core/DataSource";
  var DataSource;
  return {
    setters: [],
    execute: function() {
      'use strict';
      DataSource = $__export("DataSource", (function() {
        var DataSource = function DataSource(path) {
          this._dataReference = null;
        };
        return ($traceurRuntime.createClass)(DataSource, {
          get inheritable() {
            return false;
          },
          child: function(childName) {},
          path: function() {},
          key: function() {},
          set: function(newData) {},
          remove: function() {},
          push: function(newData) {},
          setWithPriority: function(newData, priority) {},
          setPriority: function(newPriority) {},
          setValueChangedCallback: function(callback) {},
          removeValueChangedCallback: function() {},
          setChildAddedCallback: function(callback) {},
          removeChildAddedCallback: function() {},
          setChildChangedCallback: function(callback) {},
          removeChildChangedCallback: function() {},
          setChildMovedCallback: function(callback) {},
          removeChildMovedCallback: function() {},
          setChildRemovedCallback: function(callback) {},
          removeChildRemovedCallback: function() {}
        }, {});
      }()));
    }
  };
});



System.register("github:Bizboard/arva-ds@master/utils/objectHelper", ["npm:lodash@3.7.0"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/arva-ds@master/utils/objectHelper";
  var _;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }],
    execute: function() {
      $__export('default', (function() {
        var ObjectHelper = function ObjectHelper() {};
        return ($traceurRuntime.createClass)(ObjectHelper, {}, {
          hideMethodsAndPrivatePropertiesFromObject: function(object) {
            for (var propName in object) {
              var prototype = Object.getPrototypeOf(object);
              var descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, propName) : undefined;
              if (descriptor && (descriptor.get || descriptor.set) && !propName.startsWith('_')) {
                continue;
              }
              var property = object[propName];
              if (typeof property === 'function' || propName.startsWith('_')) {
                ObjectHelper.hidePropertyFromObject(object, propName);
              }
            }
          },
          hideMethodsFromObject: function(object) {
            for (var propName in object) {
              var property = object[propName];
              if (typeof property === 'function') {
                ObjectHelper.hidePropertyFromObject(object, propName);
              }
            }
          },
          hidePropertyFromObject: function(object, propName) {
            var prototype = object;
            var descriptor = Object.getOwnPropertyDescriptor(object, propName);
            while (!descriptor) {
              prototype = Object.getPrototypeOf(prototype);
              if (prototype.constructor.name === 'Object' || prototype.constructor.name === 'Array') {
                return ;
              }
              descriptor = Object.getOwnPropertyDescriptor(prototype, propName);
            }
            descriptor.enumerable = false;
            Object.defineProperty(prototype, propName, descriptor);
            Object.defineProperty(object, propName, descriptor);
          },
          hideAllPropertiesFromObject: function(object) {
            for (var propName in object) {
              ObjectHelper.hidePropertyFromObject(object, propName);
            }
          },
          addHiddenPropertyToObject: function(object, propName, prop) {
            var writable = arguments[3] !== (void 0) ? arguments[3] : true;
            var useAccessors = arguments[4] !== (void 0) ? arguments[4] : true;
            return ObjectHelper.addPropertyToObject(object, propName, prop, false, writable, undefined, useAccessors);
          },
          addPropertyToObject: function(object, propName, prop) {
            var enumerable = arguments[3] !== (void 0) ? arguments[3] : true;
            var writable = arguments[4] !== (void 0) ? arguments[4] : true;
            var setCallback = arguments[5] !== (void 0) ? arguments[5] : null;
            var useAccessors = arguments[6] !== (void 0) ? arguments[6] : true;
            if (!writable || !useAccessors) {
              var descriptor = {
                enumerable: enumerable,
                writable: writable,
                value: prop
              };
              Object.defineProperty(object, propName, descriptor);
            } else {
              ObjectHelper.addGetSetPropertyWithShadow(object, propName, prop, enumerable, writable, setCallback);
            }
          },
          addGetSetPropertyWithShadow: function(object, propName, prop) {
            var enumerable = arguments[3] !== (void 0) ? arguments[3] : true;
            var writable = arguments[4] !== (void 0) ? arguments[4] : true;
            var setCallback = arguments[5] !== (void 0) ? arguments[5] : null;
            ObjectHelper.buildPropertyShadow(object, propName, prop);
            ObjectHelper.buildGetSetProperty(object, propName, enumerable, writable, setCallback);
          },
          buildPropertyShadow: function(object, propName, prop) {
            var shadow = {};
            if (!object || !propName) {
              debugger;
            }
            try {
              if ('shadow' in object) {
                shadow = object['shadow'];
              }
            } catch (error) {
              debugger;
            }
            shadow[propName] = prop;
            Object.defineProperty(object, 'shadow', {
              writable: true,
              configurable: true,
              enumerable: false,
              value: shadow
            });
          },
          buildGetSetProperty: function(object, propName) {
            var enumerable = arguments[2] !== (void 0) ? arguments[2] : true;
            var writable = arguments[3] !== (void 0) ? arguments[3] : true;
            var setCallback = arguments[4] !== (void 0) ? arguments[4] : null;
            var descriptor = {
              enumerable: enumerable,
              configurable: true,
              get: function() {
                return object['shadow'][propName];
              },
              set: function(value) {
                if (writable) {
                  object['shadow'][propName] = value;
                  if (setCallback && typeof setCallback === 'function') {
                    setCallback({
                      propertyName: propName,
                      newValue: value
                    });
                  }
                } else {
                  throw new ReferenceError('Attempted to write to non-writable property "' + propName + '".');
                }
              }
            };
            Object.defineProperty(object, propName, descriptor);
          },
          bindAllMethods: function(object, bindTarget) {
            var methodNames = ObjectHelper.getMethodNames(object);
            methodNames.forEach(function(name) {
              object[name] = object[name].bind(bindTarget);
            });
          },
          getMethodNames: function(object) {
            var methodNames = arguments[1] !== (void 0) ? arguments[1] : [];
            var propNames = Object.getOwnPropertyNames(object).filter(function(c) {
              return typeof object[c] === 'function';
            });
            methodNames = methodNames.concat(propNames);
            var prototype = Object.getPrototypeOf(object);
            if (prototype.constructor.name !== 'Object' && prototype.constructor.name !== 'Array') {
              return ObjectHelper.getMethodNames(prototype, methodNames);
            }
            return methodNames;
          },
          getEnumerableProperties: function(object) {
            return ObjectHelper.getPrototypeEnumerableProperties(object, object);
          },
          getPrototypeEnumerableProperties: function(rootObject, prototype) {
            var result = {};
            var propNames = Object.keys(prototype);
            for (var $__1 = propNames.values()[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__2 = void 0; !($__2 = $__1.next()).done; ) {
              var name = $__2.value;
              {
                var value = rootObject[name];
                if (value !== null && value !== undefined && typeof value !== 'function') {
                  if (typeof value == 'object') {
                    result[name] = ObjectHelper.getEnumerableProperties(value);
                  } else {
                    result[name] = value;
                  }
                }
              }
            }
            var descriptorNames = Object.getOwnPropertyNames(prototype);
            descriptorNames = descriptorNames.filter(function(name) {
              return propNames.indexOf(name) < 0;
            });
            for (var $__3 = descriptorNames.values()[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__4 = void 0; !($__4 = $__3.next()).done; ) {
              var name$__5 = $__4.value;
              {
                var descriptor = Object.getOwnPropertyDescriptor(prototype, name$__5);
                if (descriptor && descriptor.enumerable) {
                  var value$__6 = rootObject[name$__5];
                  if (value$__6 !== null && value$__6 !== undefined && typeof value$__6 !== 'function') {
                    if (typeof value$__6 == 'object') {
                      result[name$__5] = ObjectHelper.getEnumerableProperties(value$__6);
                    } else {
                      result[name$__5] = value$__6;
                    }
                  }
                }
              }
            }
            var superPrototype = Object.getPrototypeOf(prototype);
            if (superPrototype.constructor.name !== 'Object' && superPrototype.constructor.name !== 'Array') {
              var prototypeEnumerables = ObjectHelper.getPrototypeEnumerableProperties(rootObject, superPrototype);
              _.merge(result, prototypeEnumerables);
            }
            return result;
          }
        });
      }()));
    }
  };
});



System.register("github:firebase/firebase-bower@2.2.4/firebase", [], false, function(__require, __exports, __module) {
  System.get("@@global-helpers").prepareGlobal(__module.id, []);
  (function() {
    (function() {
      var h,
          aa = this;
      function n(a) {
        return void 0 !== a;
      }
      function ba() {}
      function ca(a) {
        a.ub = function() {
          return a.tf ? a.tf : a.tf = new a;
        };
      }
      function da(a) {
        var b = typeof a;
        if ("object" == b)
          if (a) {
            if (a instanceof Array)
              return "array";
            if (a instanceof Object)
              return b;
            var c = Object.prototype.toString.call(a);
            if ("[object Window]" == c)
              return "object";
            if ("[object Array]" == c || "number" == typeof a.length && "undefined" != typeof a.splice && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("splice"))
              return "array";
            if ("[object Function]" == c || "undefined" != typeof a.call && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("call"))
              return "function";
          } else
            return "null";
        else if ("function" == b && "undefined" == typeof a.call)
          return "object";
        return b;
      }
      function ea(a) {
        return "array" == da(a);
      }
      function fa(a) {
        var b = da(a);
        return "array" == b || "object" == b && "number" == typeof a.length;
      }
      function p(a) {
        return "string" == typeof a;
      }
      function ga(a) {
        return "number" == typeof a;
      }
      function ha(a) {
        return "function" == da(a);
      }
      function ia(a) {
        var b = typeof a;
        return "object" == b && null != a || "function" == b;
      }
      function ja(a, b, c) {
        return a.call.apply(a.bind, arguments);
      }
      function ka(a, b, c) {
        if (!a)
          throw Error();
        if (2 < arguments.length) {
          var d = Array.prototype.slice.call(arguments, 2);
          return function() {
            var c = Array.prototype.slice.call(arguments);
            Array.prototype.unshift.apply(c, d);
            return a.apply(b, c);
          };
        }
        return function() {
          return a.apply(b, arguments);
        };
      }
      function q(a, b, c) {
        q = Function.prototype.bind && -1 != Function.prototype.bind.toString().indexOf("native code") ? ja : ka;
        return q.apply(null, arguments);
      }
      var la = Date.now || function() {
        return +new Date;
      };
      function ma(a, b) {
        function c() {}
        c.prototype = b.prototype;
        a.Zg = b.prototype;
        a.prototype = new c;
        a.prototype.constructor = a;
        a.Vg = function(a, c, f) {
          for (var g = Array(arguments.length - 2),
              k = 2; k < arguments.length; k++)
            g[k - 2] = arguments[k];
          return b.prototype[c].apply(a, g);
        };
      }
      ;
      function r(a, b) {
        for (var c in a)
          b.call(void 0, a[c], c, a);
      }
      function na(a, b) {
        var c = {},
            d;
        for (d in a)
          c[d] = b.call(void 0, a[d], d, a);
        return c;
      }
      function oa(a, b) {
        for (var c in a)
          if (!b.call(void 0, a[c], c, a))
            return !1;
        return !0;
      }
      function pa(a) {
        var b = 0,
            c;
        for (c in a)
          b++;
        return b;
      }
      function qa(a) {
        for (var b in a)
          return b;
      }
      function ra(a) {
        var b = [],
            c = 0,
            d;
        for (d in a)
          b[c++] = a[d];
        return b;
      }
      function sa(a) {
        var b = [],
            c = 0,
            d;
        for (d in a)
          b[c++] = d;
        return b;
      }
      function ta(a, b) {
        for (var c in a)
          if (a[c] == b)
            return !0;
        return !1;
      }
      function ua(a, b, c) {
        for (var d in a)
          if (b.call(c, a[d], d, a))
            return d;
      }
      function va(a, b) {
        var c = ua(a, b, void 0);
        return c && a[c];
      }
      function wa(a) {
        for (var b in a)
          return !1;
        return !0;
      }
      function xa(a) {
        var b = {},
            c;
        for (c in a)
          b[c] = a[c];
        return b;
      }
      var ya = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
      function za(a, b) {
        for (var c,
            d,
            e = 1; e < arguments.length; e++) {
          d = arguments[e];
          for (c in d)
            a[c] = d[c];
          for (var f = 0; f < ya.length; f++)
            c = ya[f], Object.prototype.hasOwnProperty.call(d, c) && (a[c] = d[c]);
        }
      }
      ;
      function Aa(a) {
        a = String(a);
        if (/^\s*$/.test(a) ? 0 : /^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g, "@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g, "")))
          try {
            return eval("(" + a + ")");
          } catch (b) {}
        throw Error("Invalid JSON string: " + a);
      }
      function Ba() {
        this.Pd = void 0;
      }
      function Ca(a, b, c) {
        switch (typeof b) {
          case "string":
            Da(b, c);
            break;
          case "number":
            c.push(isFinite(b) && !isNaN(b) ? b : "null");
            break;
          case "boolean":
            c.push(b);
            break;
          case "undefined":
            c.push("null");
            break;
          case "object":
            if (null == b) {
              c.push("null");
              break;
            }
            if (ea(b)) {
              var d = b.length;
              c.push("[");
              for (var e = "",
                  f = 0; f < d; f++)
                c.push(e), e = b[f], Ca(a, a.Pd ? a.Pd.call(b, String(f), e) : e, c), e = ",";
              c.push("]");
              break;
            }
            c.push("{");
            d = "";
            for (f in b)
              Object.prototype.hasOwnProperty.call(b, f) && (e = b[f], "function" != typeof e && (c.push(d), Da(f, c), c.push(":"), Ca(a, a.Pd ? a.Pd.call(b, f, e) : e, c), d = ","));
            c.push("}");
            break;
          case "function":
            break;
          default:
            throw Error("Unknown type: " + typeof b);
        }
      }
      var Ea = {
        '"': '\\"',
        "\\": "\\\\",
        "/": "\\/",
        "\b": "\\b",
        "\f": "\\f",
        "\n": "\\n",
        "\r": "\\r",
        "\t": "\\t",
        "\x0B": "\\u000b"
      },
          Fa = /\uffff/.test("\uffff") ? /[\\\"\x00-\x1f\x7f-\uffff]/g : /[\\\"\x00-\x1f\x7f-\xff]/g;
      function Da(a, b) {
        b.push('"', a.replace(Fa, function(a) {
          if (a in Ea)
            return Ea[a];
          var b = a.charCodeAt(0),
              e = "\\u";
          16 > b ? e += "000" : 256 > b ? e += "00" : 4096 > b && (e += "0");
          return Ea[a] = e + b.toString(16);
        }), '"');
      }
      ;
      function Ga() {
        return Math.floor(2147483648 * Math.random()).toString(36) + Math.abs(Math.floor(2147483648 * Math.random()) ^ la()).toString(36);
      }
      ;
      var Ha;
      a: {
        var Ia = aa.navigator;
        if (Ia) {
          var Ja = Ia.userAgent;
          if (Ja) {
            Ha = Ja;
            break a;
          }
        }
        Ha = "";
      }
      ;
      function Ka() {
        this.Wa = -1;
      }
      ;
      function La() {
        this.Wa = -1;
        this.Wa = 64;
        this.R = [];
        this.le = [];
        this.Tf = [];
        this.Id = [];
        this.Id[0] = 128;
        for (var a = 1; a < this.Wa; ++a)
          this.Id[a] = 0;
        this.be = this.$b = 0;
        this.reset();
      }
      ma(La, Ka);
      La.prototype.reset = function() {
        this.R[0] = 1732584193;
        this.R[1] = 4023233417;
        this.R[2] = 2562383102;
        this.R[3] = 271733878;
        this.R[4] = 3285377520;
        this.be = this.$b = 0;
      };
      function Ma(a, b, c) {
        c || (c = 0);
        var d = a.Tf;
        if (p(b))
          for (var e = 0; 16 > e; e++)
            d[e] = b.charCodeAt(c) << 24 | b.charCodeAt(c + 1) << 16 | b.charCodeAt(c + 2) << 8 | b.charCodeAt(c + 3), c += 4;
        else
          for (e = 0; 16 > e; e++)
            d[e] = b[c] << 24 | b[c + 1] << 16 | b[c + 2] << 8 | b[c + 3], c += 4;
        for (e = 16; 80 > e; e++) {
          var f = d[e - 3] ^ d[e - 8] ^ d[e - 14] ^ d[e - 16];
          d[e] = (f << 1 | f >>> 31) & 4294967295;
        }
        b = a.R[0];
        c = a.R[1];
        for (var g = a.R[2],
            k = a.R[3],
            l = a.R[4],
            m,
            e = 0; 80 > e; e++)
          40 > e ? 20 > e ? (f = k ^ c & (g ^ k), m = 1518500249) : (f = c ^ g ^ k, m = 1859775393) : 60 > e ? (f = c & g | k & (c | g), m = 2400959708) : (f = c ^ g ^ k, m = 3395469782), f = (b << 5 | b >>> 27) + f + l + m + d[e] & 4294967295, l = k, k = g, g = (c << 30 | c >>> 2) & 4294967295, c = b, b = f;
        a.R[0] = a.R[0] + b & 4294967295;
        a.R[1] = a.R[1] + c & 4294967295;
        a.R[2] = a.R[2] + g & 4294967295;
        a.R[3] = a.R[3] + k & 4294967295;
        a.R[4] = a.R[4] + l & 4294967295;
      }
      La.prototype.update = function(a, b) {
        if (null != a) {
          n(b) || (b = a.length);
          for (var c = b - this.Wa,
              d = 0,
              e = this.le,
              f = this.$b; d < b; ) {
            if (0 == f)
              for (; d <= c; )
                Ma(this, a, d), d += this.Wa;
            if (p(a))
              for (; d < b; ) {
                if (e[f] = a.charCodeAt(d), ++f, ++d, f == this.Wa) {
                  Ma(this, e);
                  f = 0;
                  break;
                }
              }
            else
              for (; d < b; )
                if (e[f] = a[d], ++f, ++d, f == this.Wa) {
                  Ma(this, e);
                  f = 0;
                  break;
                }
          }
          this.$b = f;
          this.be += b;
        }
      };
      var t = Array.prototype,
          Na = t.indexOf ? function(a, b, c) {
            return t.indexOf.call(a, b, c);
          } : function(a, b, c) {
            c = null == c ? 0 : 0 > c ? Math.max(0, a.length + c) : c;
            if (p(a))
              return p(b) && 1 == b.length ? a.indexOf(b, c) : -1;
            for (; c < a.length; c++)
              if (c in a && a[c] === b)
                return c;
            return -1;
          },
          Oa = t.forEach ? function(a, b, c) {
            t.forEach.call(a, b, c);
          } : function(a, b, c) {
            for (var d = a.length,
                e = p(a) ? a.split("") : a,
                f = 0; f < d; f++)
              f in e && b.call(c, e[f], f, a);
          },
          Pa = t.filter ? function(a, b, c) {
            return t.filter.call(a, b, c);
          } : function(a, b, c) {
            for (var d = a.length,
                e = [],
                f = 0,
                g = p(a) ? a.split("") : a,
                k = 0; k < d; k++)
              if (k in g) {
                var l = g[k];
                b.call(c, l, k, a) && (e[f++] = l);
              }
            return e;
          },
          Qa = t.map ? function(a, b, c) {
            return t.map.call(a, b, c);
          } : function(a, b, c) {
            for (var d = a.length,
                e = Array(d),
                f = p(a) ? a.split("") : a,
                g = 0; g < d; g++)
              g in f && (e[g] = b.call(c, f[g], g, a));
            return e;
          },
          Ra = t.reduce ? function(a, b, c, d) {
            for (var e = [],
                f = 1,
                g = arguments.length; f < g; f++)
              e.push(arguments[f]);
            d && (e[0] = q(b, d));
            return t.reduce.apply(a, e);
          } : function(a, b, c, d) {
            var e = c;
            Oa(a, function(c, g) {
              e = b.call(d, e, c, g, a);
            });
            return e;
          },
          Sa = t.every ? function(a, b, c) {
            return t.every.call(a, b, c);
          } : function(a, b, c) {
            for (var d = a.length,
                e = p(a) ? a.split("") : a,
                f = 0; f < d; f++)
              if (f in e && !b.call(c, e[f], f, a))
                return !1;
            return !0;
          };
      function Ta(a, b) {
        var c = Ua(a, b, void 0);
        return 0 > c ? null : p(a) ? a.charAt(c) : a[c];
      }
      function Ua(a, b, c) {
        for (var d = a.length,
            e = p(a) ? a.split("") : a,
            f = 0; f < d; f++)
          if (f in e && b.call(c, e[f], f, a))
            return f;
        return -1;
      }
      function Va(a, b) {
        var c = Na(a, b);
        0 <= c && t.splice.call(a, c, 1);
      }
      function Wa(a, b, c) {
        return 2 >= arguments.length ? t.slice.call(a, b) : t.slice.call(a, b, c);
      }
      function Xa(a, b) {
        a.sort(b || Ya);
      }
      function Ya(a, b) {
        return a > b ? 1 : a < b ? -1 : 0;
      }
      ;
      var Za = -1 != Ha.indexOf("Opera") || -1 != Ha.indexOf("OPR"),
          $a = -1 != Ha.indexOf("Trident") || -1 != Ha.indexOf("MSIE"),
          ab = -1 != Ha.indexOf("Gecko") && -1 == Ha.toLowerCase().indexOf("webkit") && !(-1 != Ha.indexOf("Trident") || -1 != Ha.indexOf("MSIE")),
          bb = -1 != Ha.toLowerCase().indexOf("webkit");
      (function() {
        var a = "",
            b;
        if (Za && aa.opera)
          return a = aa.opera.version, ha(a) ? a() : a;
        ab ? b = /rv\:([^\);]+)(\)|;)/ : $a ? b = /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/ : bb && (b = /WebKit\/(\S+)/);
        b && (a = (a = b.exec(Ha)) ? a[1] : "");
        return $a && (b = (b = aa.document) ? b.documentMode : void 0, b > parseFloat(a)) ? String(b) : a;
      })();
      var cb = null,
          db = null,
          eb = null;
      function fb(a, b) {
        if (!fa(a))
          throw Error("encodeByteArray takes an array as a parameter");
        gb();
        for (var c = b ? db : cb,
            d = [],
            e = 0; e < a.length; e += 3) {
          var f = a[e],
              g = e + 1 < a.length,
              k = g ? a[e + 1] : 0,
              l = e + 2 < a.length,
              m = l ? a[e + 2] : 0,
              v = f >> 2,
              f = (f & 3) << 4 | k >> 4,
              k = (k & 15) << 2 | m >> 6,
              m = m & 63;
          l || (m = 64, g || (k = 64));
          d.push(c[v], c[f], c[k], c[m]);
        }
        return d.join("");
      }
      function gb() {
        if (!cb) {
          cb = {};
          db = {};
          eb = {};
          for (var a = 0; 65 > a; a++)
            cb[a] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a), db[a] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a), eb[db[a]] = a, 62 <= a && (eb["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a)] = a);
        }
      }
      ;
      function u(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
      }
      function w(a, b) {
        if (Object.prototype.hasOwnProperty.call(a, b))
          return a[b];
      }
      function hb(a, b) {
        for (var c in a)
          Object.prototype.hasOwnProperty.call(a, c) && b(c, a[c]);
      }
      function ib(a) {
        var b = {};
        hb(a, function(a, d) {
          b[a] = d;
        });
        return b;
      }
      ;
      function jb(a) {
        var b = [];
        hb(a, function(a, d) {
          ea(d) ? Oa(d, function(d) {
            b.push(encodeURIComponent(a) + "=" + encodeURIComponent(d));
          }) : b.push(encodeURIComponent(a) + "=" + encodeURIComponent(d));
        });
        return b.length ? "&" + b.join("&") : "";
      }
      function kb(a) {
        var b = {};
        a = a.replace(/^\?/, "").split("&");
        Oa(a, function(a) {
          a && (a = a.split("="), b[a[0]] = a[1]);
        });
        return b;
      }
      ;
      function x(a, b, c, d) {
        var e;
        d < b ? e = "at least " + b : d > c && (e = 0 === c ? "none" : "no more than " + c);
        if (e)
          throw Error(a + " failed: Was called with " + d + (1 === d ? " argument." : " arguments.") + " Expects " + e + ".");
      }
      function z(a, b, c) {
        var d = "";
        switch (b) {
          case 1:
            d = c ? "first" : "First";
            break;
          case 2:
            d = c ? "second" : "Second";
            break;
          case 3:
            d = c ? "third" : "Third";
            break;
          case 4:
            d = c ? "fourth" : "Fourth";
            break;
          default:
            throw Error("errorPrefix called with argumentNumber > 4.  Need to update it?");
        }
        return a = a + " failed: " + (d + " argument ");
      }
      function A(a, b, c, d) {
        if ((!d || n(c)) && !ha(c))
          throw Error(z(a, b, d) + "must be a valid function.");
      }
      function lb(a, b, c) {
        if (n(c) && (!ia(c) || null === c))
          throw Error(z(a, b, !0) + "must be a valid context object.");
      }
      ;
      function mb(a) {
        return "undefined" !== typeof JSON && n(JSON.parse) ? JSON.parse(a) : Aa(a);
      }
      function B(a) {
        if ("undefined" !== typeof JSON && n(JSON.stringify))
          a = JSON.stringify(a);
        else {
          var b = [];
          Ca(new Ba, a, b);
          a = b.join("");
        }
        return a;
      }
      ;
      function nb() {
        this.Sd = C;
      }
      nb.prototype.j = function(a) {
        return this.Sd.oa(a);
      };
      nb.prototype.toString = function() {
        return this.Sd.toString();
      };
      function ob() {}
      ob.prototype.pf = function() {
        return null;
      };
      ob.prototype.xe = function() {
        return null;
      };
      var pb = new ob;
      function qb(a, b, c) {
        this.Qf = a;
        this.Ka = b;
        this.Hd = c;
      }
      qb.prototype.pf = function(a) {
        var b = this.Ka.D;
        if (rb(b, a))
          return b.j().M(a);
        b = null != this.Hd ? new sb(this.Hd, !0, !1) : this.Ka.u();
        return this.Qf.Xa(a, b);
      };
      qb.prototype.xe = function(a, b, c) {
        var d = null != this.Hd ? this.Hd : tb(this.Ka);
        a = this.Qf.me(d, b, 1, c, a);
        return 0 === a.length ? null : a[0];
      };
      function ub() {
        this.tb = [];
      }
      function vb(a, b) {
        for (var c = null,
            d = 0; d < b.length; d++) {
          var e = b[d],
              f = e.Yb();
          null === c || f.Z(c.Yb()) || (a.tb.push(c), c = null);
          null === c && (c = new wb(f));
          c.add(e);
        }
        c && a.tb.push(c);
      }
      function xb(a, b, c) {
        vb(a, c);
        yb(a, function(a) {
          return a.Z(b);
        });
      }
      function zb(a, b, c) {
        vb(a, c);
        yb(a, function(a) {
          return a.contains(b) || b.contains(a);
        });
      }
      function yb(a, b) {
        for (var c = !0,
            d = 0; d < a.tb.length; d++) {
          var e = a.tb[d];
          if (e)
            if (e = e.Yb(), b(e)) {
              for (var e = a.tb[d],
                  f = 0; f < e.sd.length; f++) {
                var g = e.sd[f];
                if (null !== g) {
                  e.sd[f] = null;
                  var k = g.Ub();
                  Ab && Bb("event: " + g.toString());
                  Cb(k);
                }
              }
              a.tb[d] = null;
            } else
              c = !1;
        }
        c && (a.tb = []);
      }
      function wb(a) {
        this.qa = a;
        this.sd = [];
      }
      wb.prototype.add = function(a) {
        this.sd.push(a);
      };
      wb.prototype.Yb = function() {
        return this.qa;
      };
      function D(a, b, c, d) {
        this.type = a;
        this.Ja = b;
        this.Ya = c;
        this.Je = d;
        this.Nd = void 0;
      }
      function Db(a) {
        return new D(Eb, a);
      }
      var Eb = "value";
      function Fb(a, b, c, d) {
        this.te = b;
        this.Wd = c;
        this.Nd = d;
        this.rd = a;
      }
      Fb.prototype.Yb = function() {
        var a = this.Wd.lc();
        return "value" === this.rd ? a.path : a.parent().path;
      };
      Fb.prototype.ye = function() {
        return this.rd;
      };
      Fb.prototype.Ub = function() {
        return this.te.Ub(this);
      };
      Fb.prototype.toString = function() {
        return this.Yb().toString() + ":" + this.rd + ":" + B(this.Wd.lf());
      };
      function Gb(a, b, c) {
        this.te = a;
        this.error = b;
        this.path = c;
      }
      Gb.prototype.Yb = function() {
        return this.path;
      };
      Gb.prototype.ye = function() {
        return "cancel";
      };
      Gb.prototype.Ub = function() {
        return this.te.Ub(this);
      };
      Gb.prototype.toString = function() {
        return this.path.toString() + ":cancel";
      };
      function sb(a, b, c) {
        this.B = a;
        this.$ = b;
        this.Tb = c;
      }
      function Hb(a) {
        return a.$;
      }
      function rb(a, b) {
        return a.$ && !a.Tb || a.B.Ha(b);
      }
      sb.prototype.j = function() {
        return this.B;
      };
      function Ib(a) {
        this.dg = a;
        this.Ad = null;
      }
      Ib.prototype.get = function() {
        var a = this.dg.get(),
            b = xa(a);
        if (this.Ad)
          for (var c in this.Ad)
            b[c] -= this.Ad[c];
        this.Ad = a;
        return b;
      };
      function Jb(a, b) {
        this.Mf = {};
        this.Yd = new Ib(a);
        this.ca = b;
        var c = 1E4 + 2E4 * Math.random();
        setTimeout(q(this.Hf, this), Math.floor(c));
      }
      Jb.prototype.Hf = function() {
        var a = this.Yd.get(),
            b = {},
            c = !1,
            d;
        for (d in a)
          0 < a[d] && u(this.Mf, d) && (b[d] = a[d], c = !0);
        c && this.ca.Te(b);
        setTimeout(q(this.Hf, this), Math.floor(6E5 * Math.random()));
      };
      function Kb() {
        this.Dc = {};
      }
      function Lb(a, b, c) {
        n(c) || (c = 1);
        u(a.Dc, b) || (a.Dc[b] = 0);
        a.Dc[b] += c;
      }
      Kb.prototype.get = function() {
        return xa(this.Dc);
      };
      var Mb = {},
          Nb = {};
      function Ob(a) {
        a = a.toString();
        Mb[a] || (Mb[a] = new Kb);
        return Mb[a];
      }
      function Pb(a, b) {
        var c = a.toString();
        Nb[c] || (Nb[c] = b());
        return Nb[c];
      }
      ;
      function E(a, b) {
        this.name = a;
        this.S = b;
      }
      function Qb(a, b) {
        return new E(a, b);
      }
      ;
      function Rb(a, b) {
        return Sb(a.name, b.name);
      }
      function Tb(a, b) {
        return Sb(a, b);
      }
      ;
      function Ub(a, b, c) {
        this.type = Vb;
        this.source = a;
        this.path = b;
        this.Ia = c;
      }
      Ub.prototype.Wc = function(a) {
        return this.path.e() ? new Ub(this.source, F, this.Ia.M(a)) : new Ub(this.source, G(this.path), this.Ia);
      };
      Ub.prototype.toString = function() {
        return "Operation(" + this.path + ": " + this.source.toString() + " overwrite: " + this.Ia.toString() + ")";
      };
      function Wb(a, b) {
        this.type = Xb;
        this.source = Yb;
        this.path = a;
        this.Ve = b;
      }
      Wb.prototype.Wc = function() {
        return this.path.e() ? this : new Wb(G(this.path), this.Ve);
      };
      Wb.prototype.toString = function() {
        return "Operation(" + this.path + ": " + this.source.toString() + " ack write revert=" + this.Ve + ")";
      };
      function Zb(a, b) {
        this.type = $b;
        this.source = a;
        this.path = b;
      }
      Zb.prototype.Wc = function() {
        return this.path.e() ? new Zb(this.source, F) : new Zb(this.source, G(this.path));
      };
      Zb.prototype.toString = function() {
        return "Operation(" + this.path + ": " + this.source.toString() + " listen_complete)";
      };
      function ac(a, b) {
        this.La = a;
        this.xa = b ? b : bc;
      }
      h = ac.prototype;
      h.Na = function(a, b) {
        return new ac(this.La, this.xa.Na(a, b, this.La).X(null, null, !1, null, null));
      };
      h.remove = function(a) {
        return new ac(this.La, this.xa.remove(a, this.La).X(null, null, !1, null, null));
      };
      h.get = function(a) {
        for (var b,
            c = this.xa; !c.e(); ) {
          b = this.La(a, c.key);
          if (0 === b)
            return c.value;
          0 > b ? c = c.left : 0 < b && (c = c.right);
        }
        return null;
      };
      function cc(a, b) {
        for (var c,
            d = a.xa,
            e = null; !d.e(); ) {
          c = a.La(b, d.key);
          if (0 === c) {
            if (d.left.e())
              return e ? e.key : null;
            for (d = d.left; !d.right.e(); )
              d = d.right;
            return d.key;
          }
          0 > c ? d = d.left : 0 < c && (e = d, d = d.right);
        }
        throw Error("Attempted to find predecessor key for a nonexistent key.  What gives?");
      }
      h.e = function() {
        return this.xa.e();
      };
      h.count = function() {
        return this.xa.count();
      };
      h.Rc = function() {
        return this.xa.Rc();
      };
      h.ec = function() {
        return this.xa.ec();
      };
      h.ha = function(a) {
        return this.xa.ha(a);
      };
      h.Wb = function(a) {
        return new dc(this.xa, null, this.La, !1, a);
      };
      h.Xb = function(a, b) {
        return new dc(this.xa, a, this.La, !1, b);
      };
      h.Zb = function(a, b) {
        return new dc(this.xa, a, this.La, !0, b);
      };
      h.rf = function(a) {
        return new dc(this.xa, null, this.La, !0, a);
      };
      function dc(a, b, c, d, e) {
        this.Rd = e || null;
        this.Ee = d;
        this.Pa = [];
        for (e = 1; !a.e(); )
          if (e = b ? c(a.key, b) : 1, d && (e *= -1), 0 > e)
            a = this.Ee ? a.left : a.right;
          else if (0 === e) {
            this.Pa.push(a);
            break;
          } else
            this.Pa.push(a), a = this.Ee ? a.right : a.left;
      }
      function H(a) {
        if (0 === a.Pa.length)
          return null;
        var b = a.Pa.pop(),
            c;
        c = a.Rd ? a.Rd(b.key, b.value) : {
          key: b.key,
          value: b.value
        };
        if (a.Ee)
          for (b = b.left; !b.e(); )
            a.Pa.push(b), b = b.right;
        else
          for (b = b.right; !b.e(); )
            a.Pa.push(b), b = b.left;
        return c;
      }
      function ec(a) {
        if (0 === a.Pa.length)
          return null;
        var b;
        b = a.Pa;
        b = b[b.length - 1];
        return a.Rd ? a.Rd(b.key, b.value) : {
          key: b.key,
          value: b.value
        };
      }
      function fc(a, b, c, d, e) {
        this.key = a;
        this.value = b;
        this.color = null != c ? c : !0;
        this.left = null != d ? d : bc;
        this.right = null != e ? e : bc;
      }
      h = fc.prototype;
      h.X = function(a, b, c, d, e) {
        return new fc(null != a ? a : this.key, null != b ? b : this.value, null != c ? c : this.color, null != d ? d : this.left, null != e ? e : this.right);
      };
      h.count = function() {
        return this.left.count() + 1 + this.right.count();
      };
      h.e = function() {
        return !1;
      };
      h.ha = function(a) {
        return this.left.ha(a) || a(this.key, this.value) || this.right.ha(a);
      };
      function gc(a) {
        return a.left.e() ? a : gc(a.left);
      }
      h.Rc = function() {
        return gc(this).key;
      };
      h.ec = function() {
        return this.right.e() ? this.key : this.right.ec();
      };
      h.Na = function(a, b, c) {
        var d,
            e;
        e = this;
        d = c(a, e.key);
        e = 0 > d ? e.X(null, null, null, e.left.Na(a, b, c), null) : 0 === d ? e.X(null, b, null, null, null) : e.X(null, null, null, null, e.right.Na(a, b, c));
        return hc(e);
      };
      function ic(a) {
        if (a.left.e())
          return bc;
        a.left.fa() || a.left.left.fa() || (a = jc(a));
        a = a.X(null, null, null, ic(a.left), null);
        return hc(a);
      }
      h.remove = function(a, b) {
        var c,
            d;
        c = this;
        if (0 > b(a, c.key))
          c.left.e() || c.left.fa() || c.left.left.fa() || (c = jc(c)), c = c.X(null, null, null, c.left.remove(a, b), null);
        else {
          c.left.fa() && (c = kc(c));
          c.right.e() || c.right.fa() || c.right.left.fa() || (c = lc(c), c.left.left.fa() && (c = kc(c), c = lc(c)));
          if (0 === b(a, c.key)) {
            if (c.right.e())
              return bc;
            d = gc(c.right);
            c = c.X(d.key, d.value, null, null, ic(c.right));
          }
          c = c.X(null, null, null, null, c.right.remove(a, b));
        }
        return hc(c);
      };
      h.fa = function() {
        return this.color;
      };
      function hc(a) {
        a.right.fa() && !a.left.fa() && (a = mc(a));
        a.left.fa() && a.left.left.fa() && (a = kc(a));
        a.left.fa() && a.right.fa() && (a = lc(a));
        return a;
      }
      function jc(a) {
        a = lc(a);
        a.right.left.fa() && (a = a.X(null, null, null, null, kc(a.right)), a = mc(a), a = lc(a));
        return a;
      }
      function mc(a) {
        return a.right.X(null, null, a.color, a.X(null, null, !0, null, a.right.left), null);
      }
      function kc(a) {
        return a.left.X(null, null, a.color, null, a.X(null, null, !0, a.left.right, null));
      }
      function lc(a) {
        return a.X(null, null, !a.color, a.left.X(null, null, !a.left.color, null, null), a.right.X(null, null, !a.right.color, null, null));
      }
      function nc() {}
      h = nc.prototype;
      h.X = function() {
        return this;
      };
      h.Na = function(a, b) {
        return new fc(a, b, null);
      };
      h.remove = function() {
        return this;
      };
      h.count = function() {
        return 0;
      };
      h.e = function() {
        return !0;
      };
      h.ha = function() {
        return !1;
      };
      h.Rc = function() {
        return null;
      };
      h.ec = function() {
        return null;
      };
      h.fa = function() {
        return !1;
      };
      var bc = new nc;
      function oc(a, b) {
        return a && "object" === typeof a ? (J(".sv" in a, "Unexpected leaf node or priority contents"), b[a[".sv"]]) : a;
      }
      function pc(a, b) {
        var c = new qc;
        rc(a, new K(""), function(a, e) {
          c.mc(a, sc(e, b));
        });
        return c;
      }
      function sc(a, b) {
        var c = a.A().K(),
            c = oc(c, b),
            d;
        if (a.N()) {
          var e = oc(a.Ba(), b);
          return e !== a.Ba() || c !== a.A().K() ? new tc(e, L(c)) : a;
        }
        d = a;
        c !== a.A().K() && (d = d.da(new tc(c)));
        a.U(M, function(a, c) {
          var e = sc(c, b);
          e !== c && (d = d.Q(a, e));
        });
        return d;
      }
      ;
      function K(a, b) {
        if (1 == arguments.length) {
          this.o = a.split("/");
          for (var c = 0,
              d = 0; d < this.o.length; d++)
            0 < this.o[d].length && (this.o[c] = this.o[d], c++);
          this.o.length = c;
          this.Y = 0;
        } else
          this.o = a, this.Y = b;
      }
      function N(a, b) {
        var c = O(a);
        if (null === c)
          return b;
        if (c === O(b))
          return N(G(a), G(b));
        throw Error("INTERNAL ERROR: innerPath (" + b + ") is not within outerPath (" + a + ")");
      }
      function O(a) {
        return a.Y >= a.o.length ? null : a.o[a.Y];
      }
      function uc(a) {
        return a.o.length - a.Y;
      }
      function G(a) {
        var b = a.Y;
        b < a.o.length && b++;
        return new K(a.o, b);
      }
      function vc(a) {
        return a.Y < a.o.length ? a.o[a.o.length - 1] : null;
      }
      h = K.prototype;
      h.toString = function() {
        for (var a = "",
            b = this.Y; b < this.o.length; b++)
          "" !== this.o[b] && (a += "/" + this.o[b]);
        return a || "/";
      };
      h.slice = function(a) {
        return this.o.slice(this.Y + (a || 0));
      };
      h.parent = function() {
        if (this.Y >= this.o.length)
          return null;
        for (var a = [],
            b = this.Y; b < this.o.length - 1; b++)
          a.push(this.o[b]);
        return new K(a, 0);
      };
      h.w = function(a) {
        for (var b = [],
            c = this.Y; c < this.o.length; c++)
          b.push(this.o[c]);
        if (a instanceof K)
          for (c = a.Y; c < a.o.length; c++)
            b.push(a.o[c]);
        else
          for (a = a.split("/"), c = 0; c < a.length; c++)
            0 < a[c].length && b.push(a[c]);
        return new K(b, 0);
      };
      h.e = function() {
        return this.Y >= this.o.length;
      };
      h.Z = function(a) {
        if (uc(this) !== uc(a))
          return !1;
        for (var b = this.Y,
            c = a.Y; b <= this.o.length; b++, c++)
          if (this.o[b] !== a.o[c])
            return !1;
        return !0;
      };
      h.contains = function(a) {
        var b = this.Y,
            c = a.Y;
        if (uc(this) > uc(a))
          return !1;
        for (; b < this.o.length; ) {
          if (this.o[b] !== a.o[c])
            return !1;
          ++b;
          ++c;
        }
        return !0;
      };
      var F = new K("");
      function wc(a, b) {
        this.Qa = a.slice();
        this.Ea = Math.max(1, this.Qa.length);
        this.kf = b;
        for (var c = 0; c < this.Qa.length; c++)
          this.Ea += xc(this.Qa[c]);
        yc(this);
      }
      wc.prototype.push = function(a) {
        0 < this.Qa.length && (this.Ea += 1);
        this.Qa.push(a);
        this.Ea += xc(a);
        yc(this);
      };
      wc.prototype.pop = function() {
        var a = this.Qa.pop();
        this.Ea -= xc(a);
        0 < this.Qa.length && --this.Ea;
      };
      function yc(a) {
        if (768 < a.Ea)
          throw Error(a.kf + "has a key path longer than 768 bytes (" + a.Ea + ").");
        if (32 < a.Qa.length)
          throw Error(a.kf + "path specified exceeds the maximum depth that can be written (32) or object contains a cycle " + zc(a));
      }
      function zc(a) {
        return 0 == a.Qa.length ? "" : "in property '" + a.Qa.join(".") + "'";
      }
      ;
      function Ac() {
        this.wc = {};
      }
      Ac.prototype.set = function(a, b) {
        null == b ? delete this.wc[a] : this.wc[a] = b;
      };
      Ac.prototype.get = function(a) {
        return u(this.wc, a) ? this.wc[a] : null;
      };
      Ac.prototype.remove = function(a) {
        delete this.wc[a];
      };
      Ac.prototype.uf = !0;
      function Bc(a) {
        this.Ec = a;
        this.Md = "firebase:";
      }
      h = Bc.prototype;
      h.set = function(a, b) {
        null == b ? this.Ec.removeItem(this.Md + a) : this.Ec.setItem(this.Md + a, B(b));
      };
      h.get = function(a) {
        a = this.Ec.getItem(this.Md + a);
        return null == a ? null : mb(a);
      };
      h.remove = function(a) {
        this.Ec.removeItem(this.Md + a);
      };
      h.uf = !1;
      h.toString = function() {
        return this.Ec.toString();
      };
      function Cc(a) {
        try {
          if ("undefined" !== typeof window && "undefined" !== typeof window[a]) {
            var b = window[a];
            b.setItem("firebase:sentinel", "cache");
            b.removeItem("firebase:sentinel");
            return new Bc(b);
          }
        } catch (c) {}
        return new Ac;
      }
      var Dc = Cc("localStorage"),
          P = Cc("sessionStorage");
      function Ec(a, b, c, d, e) {
        this.host = a.toLowerCase();
        this.domain = this.host.substr(this.host.indexOf(".") + 1);
        this.lb = b;
        this.Cb = c;
        this.Tg = d;
        this.Ld = e || "";
        this.Oa = Dc.get("host:" + a) || this.host;
      }
      function Fc(a, b) {
        b !== a.Oa && (a.Oa = b, "s-" === a.Oa.substr(0, 2) && Dc.set("host:" + a.host, a.Oa));
      }
      Ec.prototype.toString = function() {
        var a = (this.lb ? "https://" : "http://") + this.host;
        this.Ld && (a += "<" + this.Ld + ">");
        return a;
      };
      var Gc = function() {
        var a = 1;
        return function() {
          return a++;
        };
      }();
      function J(a, b) {
        if (!a)
          throw Hc(b);
      }
      function Hc(a) {
        return Error("Firebase (2.2.4) INTERNAL ASSERT FAILED: " + a);
      }
      function Ic(a) {
        try {
          var b;
          if ("undefined" !== typeof atob)
            b = atob(a);
          else {
            gb();
            for (var c = eb,
                d = [],
                e = 0; e < a.length; ) {
              var f = c[a.charAt(e++)],
                  g = e < a.length ? c[a.charAt(e)] : 0;
              ++e;
              var k = e < a.length ? c[a.charAt(e)] : 64;
              ++e;
              var l = e < a.length ? c[a.charAt(e)] : 64;
              ++e;
              if (null == f || null == g || null == k || null == l)
                throw Error();
              d.push(f << 2 | g >> 4);
              64 != k && (d.push(g << 4 & 240 | k >> 2), 64 != l && d.push(k << 6 & 192 | l));
            }
            if (8192 > d.length)
              b = String.fromCharCode.apply(null, d);
            else {
              a = "";
              for (c = 0; c < d.length; c += 8192)
                a += String.fromCharCode.apply(null, Wa(d, c, c + 8192));
              b = a;
            }
          }
          return b;
        } catch (m) {
          Bb("base64Decode failed: ", m);
        }
        return null;
      }
      function Jc(a) {
        var b = Kc(a);
        a = new La;
        a.update(b);
        var b = [],
            c = 8 * a.be;
        56 > a.$b ? a.update(a.Id, 56 - a.$b) : a.update(a.Id, a.Wa - (a.$b - 56));
        for (var d = a.Wa - 1; 56 <= d; d--)
          a.le[d] = c & 255, c /= 256;
        Ma(a, a.le);
        for (d = c = 0; 5 > d; d++)
          for (var e = 24; 0 <= e; e -= 8)
            b[c] = a.R[d] >> e & 255, ++c;
        return fb(b);
      }
      function Lc(a) {
        for (var b = "",
            c = 0; c < arguments.length; c++)
          b = fa(arguments[c]) ? b + Lc.apply(null, arguments[c]) : "object" === typeof arguments[c] ? b + B(arguments[c]) : b + arguments[c], b += " ";
        return b;
      }
      var Ab = null,
          Mc = !0;
      function Bb(a) {
        !0 === Mc && (Mc = !1, null === Ab && !0 === P.get("logging_enabled") && Nc(!0));
        if (Ab) {
          var b = Lc.apply(null, arguments);
          Ab(b);
        }
      }
      function Oc(a) {
        return function() {
          Bb(a, arguments);
        };
      }
      function Pc(a) {
        if ("undefined" !== typeof console) {
          var b = "FIREBASE INTERNAL ERROR: " + Lc.apply(null, arguments);
          "undefined" !== typeof console.error ? console.error(b) : console.log(b);
        }
      }
      function Qc(a) {
        var b = Lc.apply(null, arguments);
        throw Error("FIREBASE FATAL ERROR: " + b);
      }
      function Q(a) {
        if ("undefined" !== typeof console) {
          var b = "FIREBASE WARNING: " + Lc.apply(null, arguments);
          "undefined" !== typeof console.warn ? console.warn(b) : console.log(b);
        }
      }
      function Rc(a) {
        var b = "",
            c = "",
            d = "",
            e = "",
            f = !0,
            g = "https",
            k = 443;
        if (p(a)) {
          var l = a.indexOf("//");
          0 <= l && (g = a.substring(0, l - 1), a = a.substring(l + 2));
          l = a.indexOf("/");
          -1 === l && (l = a.length);
          b = a.substring(0, l);
          e = "";
          a = a.substring(l).split("/");
          for (l = 0; l < a.length; l++)
            if (0 < a[l].length) {
              var m = a[l];
              try {
                m = decodeURIComponent(m.replace(/\+/g, " "));
              } catch (v) {}
              e += "/" + m;
            }
          a = b.split(".");
          3 === a.length ? (c = a[1], d = a[0].toLowerCase()) : 2 === a.length && (c = a[0]);
          l = b.indexOf(":");
          0 <= l && (f = "https" === g || "wss" === g, k = b.substring(l + 1), isFinite(k) && (k = String(k)), k = p(k) ? /^\s*-?0x/i.test(k) ? parseInt(k, 16) : parseInt(k, 10) : NaN);
        }
        return {
          host: b,
          port: k,
          domain: c,
          Qg: d,
          lb: f,
          scheme: g,
          Zc: e
        };
      }
      function Sc(a) {
        return ga(a) && (a != a || a == Number.POSITIVE_INFINITY || a == Number.NEGATIVE_INFINITY);
      }
      function Tc(a) {
        if ("complete" === document.readyState)
          a();
        else {
          var b = !1,
              c = function() {
                document.body ? b || (b = !0, a()) : setTimeout(c, Math.floor(10));
              };
          document.addEventListener ? (document.addEventListener("DOMContentLoaded", c, !1), window.addEventListener("load", c, !1)) : document.attachEvent && (document.attachEvent("onreadystatechange", function() {
            "complete" === document.readyState && c();
          }), window.attachEvent("onload", c));
        }
      }
      function Sb(a, b) {
        if (a === b)
          return 0;
        if ("[MIN_NAME]" === a || "[MAX_NAME]" === b)
          return -1;
        if ("[MIN_NAME]" === b || "[MAX_NAME]" === a)
          return 1;
        var c = Uc(a),
            d = Uc(b);
        return null !== c ? null !== d ? 0 == c - d ? a.length - b.length : c - d : -1 : null !== d ? 1 : a < b ? -1 : 1;
      }
      function Vc(a, b) {
        if (b && a in b)
          return b[a];
        throw Error("Missing required key (" + a + ") in object: " + B(b));
      }
      function Wc(a) {
        if ("object" !== typeof a || null === a)
          return B(a);
        var b = [],
            c;
        for (c in a)
          b.push(c);
        b.sort();
        c = "{";
        for (var d = 0; d < b.length; d++)
          0 !== d && (c += ","), c += B(b[d]), c += ":", c += Wc(a[b[d]]);
        return c + "}";
      }
      function Xc(a, b) {
        if (a.length <= b)
          return [a];
        for (var c = [],
            d = 0; d < a.length; d += b)
          d + b > a ? c.push(a.substring(d, a.length)) : c.push(a.substring(d, d + b));
        return c;
      }
      function Yc(a, b) {
        if (ea(a))
          for (var c = 0; c < a.length; ++c)
            b(c, a[c]);
        else
          r(a, b);
      }
      function Zc(a) {
        J(!Sc(a), "Invalid JSON number");
        var b,
            c,
            d,
            e;
        0 === a ? (d = c = 0, b = -Infinity === 1 / a ? 1 : 0) : (b = 0 > a, a = Math.abs(a), a >= Math.pow(2, -1022) ? (d = Math.min(Math.floor(Math.log(a) / Math.LN2), 1023), c = d + 1023, d = Math.round(a * Math.pow(2, 52 - d) - Math.pow(2, 52))) : (c = 0, d = Math.round(a / Math.pow(2, -1074))));
        e = [];
        for (a = 52; a; --a)
          e.push(d % 2 ? 1 : 0), d = Math.floor(d / 2);
        for (a = 11; a; --a)
          e.push(c % 2 ? 1 : 0), c = Math.floor(c / 2);
        e.push(b ? 1 : 0);
        e.reverse();
        b = e.join("");
        c = "";
        for (a = 0; 64 > a; a += 8)
          d = parseInt(b.substr(a, 8), 2).toString(16), 1 === d.length && (d = "0" + d), c += d;
        return c.toLowerCase();
      }
      var $c = /^-?\d{1,10}$/;
      function Uc(a) {
        return $c.test(a) && (a = Number(a), -2147483648 <= a && 2147483647 >= a) ? a : null;
      }
      function Cb(a) {
        try {
          a();
        } catch (b) {
          setTimeout(function() {
            Q("Exception was thrown by user callback.", b.stack || "");
            throw b;
          }, Math.floor(0));
        }
      }
      function R(a, b) {
        if (ha(a)) {
          var c = Array.prototype.slice.call(arguments, 1).slice();
          Cb(function() {
            a.apply(null, c);
          });
        }
      }
      ;
      function Kc(a) {
        for (var b = [],
            c = 0,
            d = 0; d < a.length; d++) {
          var e = a.charCodeAt(d);
          55296 <= e && 56319 >= e && (e -= 55296, d++, J(d < a.length, "Surrogate pair missing trail surrogate."), e = 65536 + (e << 10) + (a.charCodeAt(d) - 56320));
          128 > e ? b[c++] = e : (2048 > e ? b[c++] = e >> 6 | 192 : (65536 > e ? b[c++] = e >> 12 | 224 : (b[c++] = e >> 18 | 240, b[c++] = e >> 12 & 63 | 128), b[c++] = e >> 6 & 63 | 128), b[c++] = e & 63 | 128);
        }
        return b;
      }
      function xc(a) {
        for (var b = 0,
            c = 0; c < a.length; c++) {
          var d = a.charCodeAt(c);
          128 > d ? b++ : 2048 > d ? b += 2 : 55296 <= d && 56319 >= d ? (b += 4, c++) : b += 3;
        }
        return b;
      }
      ;
      function ad(a) {
        var b = {},
            c = {},
            d = {},
            e = "";
        try {
          var f = a.split("."),
              b = mb(Ic(f[0]) || ""),
              c = mb(Ic(f[1]) || ""),
              e = f[2],
              d = c.d || {};
          delete c.d;
        } catch (g) {}
        return {
          Wg: b,
          Ac: c,
          data: d,
          Ng: e
        };
      }
      function bd(a) {
        a = ad(a).Ac;
        return "object" === typeof a && a.hasOwnProperty("iat") ? w(a, "iat") : null;
      }
      function cd(a) {
        a = ad(a);
        var b = a.Ac;
        return !!a.Ng && !!b && "object" === typeof b && b.hasOwnProperty("iat");
      }
      ;
      function dd(a) {
        this.V = a;
        this.g = a.n.g;
      }
      function ed(a, b, c, d) {
        var e = [],
            f = [];
        Oa(b, function(b) {
          "child_changed" === b.type && a.g.xd(b.Je, b.Ja) && f.push(new D("child_moved", b.Ja, b.Ya));
        });
        fd(a, e, "child_removed", b, d, c);
        fd(a, e, "child_added", b, d, c);
        fd(a, e, "child_moved", f, d, c);
        fd(a, e, "child_changed", b, d, c);
        fd(a, e, Eb, b, d, c);
        return e;
      }
      function fd(a, b, c, d, e, f) {
        d = Pa(d, function(a) {
          return a.type === c;
        });
        Xa(d, q(a.eg, a));
        Oa(d, function(c) {
          var d = gd(a, c, f);
          Oa(e, function(e) {
            e.Jf(c.type) && b.push(e.createEvent(d, a.V));
          });
        });
      }
      function gd(a, b, c) {
        "value" !== b.type && "child_removed" !== b.type && (b.Nd = c.qf(b.Ya, b.Ja, a.g));
        return b;
      }
      dd.prototype.eg = function(a, b) {
        if (null == a.Ya || null == b.Ya)
          throw Hc("Should only compare child_ events.");
        return this.g.compare(new E(a.Ya, a.Ja), new E(b.Ya, b.Ja));
      };
      function hd() {
        this.eb = {};
      }
      function id(a, b) {
        var c = b.type,
            d = b.Ya;
        J("child_added" == c || "child_changed" == c || "child_removed" == c, "Only child changes supported for tracking");
        J(".priority" !== d, "Only non-priority child changes can be tracked.");
        var e = w(a.eb, d);
        if (e) {
          var f = e.type;
          if ("child_added" == c && "child_removed" == f)
            a.eb[d] = new D("child_changed", b.Ja, d, e.Ja);
          else if ("child_removed" == c && "child_added" == f)
            delete a.eb[d];
          else if ("child_removed" == c && "child_changed" == f)
            a.eb[d] = new D("child_removed", e.Je, d);
          else if ("child_changed" == c && "child_added" == f)
            a.eb[d] = new D("child_added", b.Ja, d);
          else if ("child_changed" == c && "child_changed" == f)
            a.eb[d] = new D("child_changed", b.Ja, d, e.Je);
          else
            throw Hc("Illegal combination of changes: " + b + " occurred after " + e);
        } else
          a.eb[d] = b;
      }
      ;
      function jd(a, b, c) {
        this.Pb = a;
        this.qb = b;
        this.sb = c || null;
      }
      h = jd.prototype;
      h.Jf = function(a) {
        return "value" === a;
      };
      h.createEvent = function(a, b) {
        var c = b.n.g;
        return new Fb("value", this, new S(a.Ja, b.lc(), c));
      };
      h.Ub = function(a) {
        var b = this.sb;
        if ("cancel" === a.ye()) {
          J(this.qb, "Raising a cancel event on a listener with no cancel callback");
          var c = this.qb;
          return function() {
            c.call(b, a.error);
          };
        }
        var d = this.Pb;
        return function() {
          d.call(b, a.Wd);
        };
      };
      h.ff = function(a, b) {
        return this.qb ? new Gb(this, a, b) : null;
      };
      h.matches = function(a) {
        return a instanceof jd ? a.Pb && this.Pb ? a.Pb === this.Pb && a.sb === this.sb : !0 : !1;
      };
      h.sf = function() {
        return null !== this.Pb;
      };
      function kd(a, b, c) {
        this.ga = a;
        this.qb = b;
        this.sb = c;
      }
      h = kd.prototype;
      h.Jf = function(a) {
        a = "children_added" === a ? "child_added" : a;
        return ("children_removed" === a ? "child_removed" : a) in this.ga;
      };
      h.ff = function(a, b) {
        return this.qb ? new Gb(this, a, b) : null;
      };
      h.createEvent = function(a, b) {
        J(null != a.Ya, "Child events should have a childName.");
        var c = b.lc().w(a.Ya);
        return new Fb(a.type, this, new S(a.Ja, c, b.n.g), a.Nd);
      };
      h.Ub = function(a) {
        var b = this.sb;
        if ("cancel" === a.ye()) {
          J(this.qb, "Raising a cancel event on a listener with no cancel callback");
          var c = this.qb;
          return function() {
            c.call(b, a.error);
          };
        }
        var d = this.ga[a.rd];
        return function() {
          d.call(b, a.Wd, a.Nd);
        };
      };
      h.matches = function(a) {
        if (a instanceof kd) {
          if (!this.ga || !a.ga)
            return !0;
          if (this.sb === a.sb) {
            var b = pa(a.ga);
            if (b === pa(this.ga)) {
              if (1 === b) {
                var b = qa(a.ga),
                    c = qa(this.ga);
                return c === b && (!a.ga[b] || !this.ga[c] || a.ga[b] === this.ga[c]);
              }
              return oa(this.ga, function(b, c) {
                return a.ga[c] === b;
              });
            }
          }
        }
        return !1;
      };
      h.sf = function() {
        return null !== this.ga;
      };
      function ld(a) {
        this.g = a;
      }
      h = ld.prototype;
      h.G = function(a, b, c, d, e) {
        J(a.Ic(this.g), "A node must be indexed if only a child is updated");
        d = a.M(b);
        if (d.Z(c))
          return a;
        null != e && (c.e() ? a.Ha(b) ? id(e, new D("child_removed", d, b)) : J(a.N(), "A child remove without an old child only makes sense on a leaf node") : d.e() ? id(e, new D("child_added", c, b)) : id(e, new D("child_changed", c, b, d)));
        return a.N() && c.e() ? a : a.Q(b, c).mb(this.g);
      };
      h.ta = function(a, b, c) {
        null != c && (a.N() || a.U(M, function(a, e) {
          b.Ha(a) || id(c, new D("child_removed", e, a));
        }), b.N() || b.U(M, function(b, e) {
          if (a.Ha(b)) {
            var f = a.M(b);
            f.Z(e) || id(c, new D("child_changed", e, b, f));
          } else
            id(c, new D("child_added", e, b));
        }));
        return b.mb(this.g);
      };
      h.da = function(a, b) {
        return a.e() ? C : a.da(b);
      };
      h.Ga = function() {
        return !1;
      };
      h.Vb = function() {
        return this;
      };
      function md(a) {
        this.Ae = new ld(a.g);
        this.g = a.g;
        var b;
        a.la ? (b = nd(a), b = a.g.Oc(od(a), b)) : b = a.g.Sc();
        this.dd = b;
        a.na ? (b = pd(a), a = a.g.Oc(qd(a), b)) : a = a.g.Pc();
        this.Fc = a;
      }
      h = md.prototype;
      h.matches = function(a) {
        return 0 >= this.g.compare(this.dd, a) && 0 >= this.g.compare(a, this.Fc);
      };
      h.G = function(a, b, c, d, e) {
        this.matches(new E(b, c)) || (c = C);
        return this.Ae.G(a, b, c, d, e);
      };
      h.ta = function(a, b, c) {
        b.N() && (b = C);
        var d = b.mb(this.g),
            d = d.da(C),
            e = this;
        b.U(M, function(a, b) {
          e.matches(new E(a, b)) || (d = d.Q(a, C));
        });
        return this.Ae.ta(a, d, c);
      };
      h.da = function(a) {
        return a;
      };
      h.Ga = function() {
        return !0;
      };
      h.Vb = function() {
        return this.Ae;
      };
      function rd(a) {
        this.ra = new md(a);
        this.g = a.g;
        J(a.ia, "Only valid if limit has been set");
        this.ja = a.ja;
        this.Jb = !sd(a);
      }
      h = rd.prototype;
      h.G = function(a, b, c, d, e) {
        this.ra.matches(new E(b, c)) || (c = C);
        return a.M(b).Z(c) ? a : a.Db() < this.ja ? this.ra.Vb().G(a, b, c, d, e) : td(this, a, b, c, d, e);
      };
      h.ta = function(a, b, c) {
        var d;
        if (b.N() || b.e())
          d = C.mb(this.g);
        else if (2 * this.ja < b.Db() && b.Ic(this.g)) {
          d = C.mb(this.g);
          b = this.Jb ? b.Zb(this.ra.Fc, this.g) : b.Xb(this.ra.dd, this.g);
          for (var e = 0; 0 < b.Pa.length && e < this.ja; ) {
            var f = H(b),
                g;
            if (g = this.Jb ? 0 >= this.g.compare(this.ra.dd, f) : 0 >= this.g.compare(f, this.ra.Fc))
              d = d.Q(f.name, f.S), e++;
            else
              break;
          }
        } else {
          d = b.mb(this.g);
          d = d.da(C);
          var k,
              l,
              m;
          if (this.Jb) {
            b = d.rf(this.g);
            k = this.ra.Fc;
            l = this.ra.dd;
            var v = ud(this.g);
            m = function(a, b) {
              return v(b, a);
            };
          } else
            b = d.Wb(this.g), k = this.ra.dd, l = this.ra.Fc, m = ud(this.g);
          for (var e = 0,
              y = !1; 0 < b.Pa.length; )
            f = H(b), !y && 0 >= m(k, f) && (y = !0), (g = y && e < this.ja && 0 >= m(f, l)) ? e++ : d = d.Q(f.name, C);
        }
        return this.ra.Vb().ta(a, d, c);
      };
      h.da = function(a) {
        return a;
      };
      h.Ga = function() {
        return !0;
      };
      h.Vb = function() {
        return this.ra.Vb();
      };
      function td(a, b, c, d, e, f) {
        var g;
        if (a.Jb) {
          var k = ud(a.g);
          g = function(a, b) {
            return k(b, a);
          };
        } else
          g = ud(a.g);
        J(b.Db() == a.ja, "");
        var l = new E(c, d),
            m = a.Jb ? wd(b, a.g) : xd(b, a.g),
            v = a.ra.matches(l);
        if (b.Ha(c)) {
          var y = b.M(c),
              m = e.xe(a.g, m, a.Jb);
          null != m && m.name == c && (m = e.xe(a.g, m, a.Jb));
          e = null == m ? 1 : g(m, l);
          if (v && !d.e() && 0 <= e)
            return null != f && id(f, new D("child_changed", d, c, y)), b.Q(c, d);
          null != f && id(f, new D("child_removed", y, c));
          b = b.Q(c, C);
          return null != m && a.ra.matches(m) ? (null != f && id(f, new D("child_added", m.S, m.name)), b.Q(m.name, m.S)) : b;
        }
        return d.e() ? b : v && 0 <= g(m, l) ? (null != f && (id(f, new D("child_removed", m.S, m.name)), id(f, new D("child_added", d, c))), b.Q(c, d).Q(m.name, C)) : b;
      }
      ;
      function yd(a, b) {
        this.he = a;
        this.cg = b;
      }
      function zd(a) {
        this.I = a;
      }
      zd.prototype.bb = function(a, b, c, d) {
        var e = new hd,
            f;
        if (b.type === Vb)
          b.source.ve ? c = Ad(this, a, b.path, b.Ia, c, d, e) : (J(b.source.of, "Unknown source."), f = b.source.af, c = Bd(this, a, b.path, b.Ia, c, d, f, e));
        else if (b.type === Cd)
          b.source.ve ? c = Dd(this, a, b.path, b.children, c, d, e) : (J(b.source.of, "Unknown source."), f = b.source.af, c = Ed(this, a, b.path, b.children, c, d, f, e));
        else if (b.type === Xb)
          if (b.Ve)
            if (f = b.path, null != c.sc(f))
              c = a;
            else {
              b = new qb(c, a, d);
              d = a.D.j();
              if (f.e() || ".priority" === O(f))
                Hb(a.u()) ? b = c.ua(tb(a)) : (b = a.u().j(), J(b instanceof T, "serverChildren would be complete if leaf node"), b = c.xc(b)), b = this.I.ta(d, b, e);
              else {
                f = O(f);
                var g = c.Xa(f, a.u());
                null == g && rb(a.u(), f) && (g = d.M(f));
                b = null != g ? this.I.G(d, f, g, b, e) : a.D.j().Ha(f) ? this.I.G(d, f, C, b, e) : d;
                b.e() && Hb(a.u()) && (d = c.ua(tb(a)), d.N() && (b = this.I.ta(b, d, e)));
              }
              d = Hb(a.u()) || null != c.sc(F);
              c = Fd(a, b, d, this.I.Ga());
            }
          else
            c = Gd(this, a, b.path, c, d, e);
        else if (b.type === $b)
          d = b.path, b = a.u(), f = b.j(), g = b.$ || d.e(), c = Hd(this, new Id(a.D, new sb(f, g, b.Tb)), d, c, pb, e);
        else
          throw Hc("Unknown operation type: " + b.type);
        e = ra(e.eb);
        d = c;
        b = d.D;
        b.$ && (f = b.j().N() || b.j().e(), g = Jd(a), (0 < e.length || !a.D.$ || f && !b.j().Z(g) || !b.j().A().Z(g.A())) && e.push(Db(Jd(d))));
        return new yd(c, e);
      };
      function Hd(a, b, c, d, e, f) {
        var g = b.D;
        if (null != d.sc(c))
          return b;
        var k;
        if (c.e())
          J(Hb(b.u()), "If change path is empty, we must have complete server data"), b.u().Tb ? (e = tb(b), d = d.xc(e instanceof T ? e : C)) : d = d.ua(tb(b)), f = a.I.ta(b.D.j(), d, f);
        else {
          var l = O(c);
          if (".priority" == l)
            J(1 == uc(c), "Can't have a priority with additional path components"), f = g.j(), k = b.u().j(), d = d.hd(c, f, k), f = null != d ? a.I.da(f, d) : g.j();
          else {
            var m = G(c);
            rb(g, l) ? (k = b.u().j(), d = d.hd(c, g.j(), k), d = null != d ? g.j().M(l).G(m, d) : g.j().M(l)) : d = d.Xa(l, b.u());
            f = null != d ? a.I.G(g.j(), l, d, e, f) : g.j();
          }
        }
        return Fd(b, f, g.$ || c.e(), a.I.Ga());
      }
      function Bd(a, b, c, d, e, f, g, k) {
        var l = b.u();
        g = g ? a.I : a.I.Vb();
        if (c.e())
          d = g.ta(l.j(), d, null);
        else if (g.Ga() && !l.Tb)
          d = l.j().G(c, d), d = g.ta(l.j(), d, null);
        else {
          var m = O(c);
          if ((c.e() ? !l.$ || l.Tb : !rb(l, O(c))) && 1 < uc(c))
            return b;
          d = l.j().M(m).G(G(c), d);
          d = ".priority" == m ? g.da(l.j(), d) : g.G(l.j(), m, d, pb, null);
        }
        l = l.$ || c.e();
        b = new Id(b.D, new sb(d, l, g.Ga()));
        return Hd(a, b, c, e, new qb(e, b, f), k);
      }
      function Ad(a, b, c, d, e, f, g) {
        var k = b.D;
        e = new qb(e, b, f);
        if (c.e())
          g = a.I.ta(b.D.j(), d, g), a = Fd(b, g, !0, a.I.Ga());
        else if (f = O(c), ".priority" === f)
          g = a.I.da(b.D.j(), d), a = Fd(b, g, k.$, k.Tb);
        else {
          var l = G(c);
          c = k.j().M(f);
          if (!l.e()) {
            var m = e.pf(f);
            d = null != m ? ".priority" === vc(l) && m.oa(l.parent()).e() ? m : m.G(l, d) : C;
          }
          c.Z(d) ? a = b : (g = a.I.G(k.j(), f, d, e, g), a = Fd(b, g, k.$, a.I.Ga()));
        }
        return a;
      }
      function Dd(a, b, c, d, e, f, g) {
        var k = b;
        Kd(d, function(d, m) {
          var v = c.w(d);
          rb(b.D, O(v)) && (k = Ad(a, k, v, m, e, f, g));
        });
        Kd(d, function(d, m) {
          var v = c.w(d);
          rb(b.D, O(v)) || (k = Ad(a, k, v, m, e, f, g));
        });
        return k;
      }
      function Ld(a, b) {
        Kd(b, function(b, d) {
          a = a.G(b, d);
        });
        return a;
      }
      function Ed(a, b, c, d, e, f, g, k) {
        if (b.u().j().e() && !Hb(b.u()))
          return b;
        var l = b;
        c = c.e() ? d : Md(Nd, c, d);
        var m = b.u().j();
        c.children.ha(function(c, d) {
          if (m.Ha(c)) {
            var I = b.u().j().M(c),
                I = Ld(I, d);
            l = Bd(a, l, new K(c), I, e, f, g, k);
          }
        });
        c.children.ha(function(c, d) {
          var I = !Hb(b.u()) && null == d.value;
          m.Ha(c) || I || (I = b.u().j().M(c), I = Ld(I, d), l = Bd(a, l, new K(c), I, e, f, g, k));
        });
        return l;
      }
      function Gd(a, b, c, d, e, f) {
        if (null != d.sc(c))
          return b;
        var g = new qb(d, b, e),
            k = e = b.D.j();
        if (Hb(b.u())) {
          if (c.e())
            e = d.ua(tb(b)), k = a.I.ta(b.D.j(), e, f);
          else if (".priority" === O(c)) {
            var l = d.Xa(O(c), b.u());
            null == l || e.e() || e.A().Z(l) || (k = a.I.da(e, l));
          } else
            l = O(c), e = d.Xa(l, b.u()), null != e && (k = a.I.G(b.D.j(), l, e, g, f));
          e = !0;
        } else if (b.D.$ || c.e())
          k = e, e = b.D.j(), e.N() || e.U(M, function(c) {
            var e = d.Xa(c, b.u());
            null != e && (k = a.I.G(k, c, e, g, f));
          }), e = b.D.$;
        else {
          l = O(c);
          if (1 == uc(c) || rb(b.D, l))
            c = d.Xa(l, b.u()), null != c && (k = a.I.G(e, l, c, g, f));
          e = !1;
        }
        return Fd(b, k, e, a.I.Ga());
      }
      ;
      function Od() {}
      var Pd = {};
      function ud(a) {
        return q(a.compare, a);
      }
      Od.prototype.xd = function(a, b) {
        return 0 !== this.compare(new E("[MIN_NAME]", a), new E("[MIN_NAME]", b));
      };
      Od.prototype.Sc = function() {
        return Qd;
      };
      function Rd(a) {
        this.bc = a;
      }
      ma(Rd, Od);
      h = Rd.prototype;
      h.Hc = function(a) {
        return !a.M(this.bc).e();
      };
      h.compare = function(a, b) {
        var c = a.S.M(this.bc),
            d = b.S.M(this.bc),
            c = c.Cc(d);
        return 0 === c ? Sb(a.name, b.name) : c;
      };
      h.Oc = function(a, b) {
        var c = L(a),
            c = C.Q(this.bc, c);
        return new E(b, c);
      };
      h.Pc = function() {
        var a = C.Q(this.bc, Sd);
        return new E("[MAX_NAME]", a);
      };
      h.toString = function() {
        return this.bc;
      };
      function Td() {}
      ma(Td, Od);
      h = Td.prototype;
      h.compare = function(a, b) {
        var c = a.S.A(),
            d = b.S.A(),
            c = c.Cc(d);
        return 0 === c ? Sb(a.name, b.name) : c;
      };
      h.Hc = function(a) {
        return !a.A().e();
      };
      h.xd = function(a, b) {
        return !a.A().Z(b.A());
      };
      h.Sc = function() {
        return Qd;
      };
      h.Pc = function() {
        return new E("[MAX_NAME]", new tc("[PRIORITY-POST]", Sd));
      };
      h.Oc = function(a, b) {
        var c = L(a);
        return new E(b, new tc("[PRIORITY-POST]", c));
      };
      h.toString = function() {
        return ".priority";
      };
      var M = new Td;
      function Ud() {}
      ma(Ud, Od);
      h = Ud.prototype;
      h.compare = function(a, b) {
        return Sb(a.name, b.name);
      };
      h.Hc = function() {
        throw Hc("KeyIndex.isDefinedOn not expected to be called.");
      };
      h.xd = function() {
        return !1;
      };
      h.Sc = function() {
        return Qd;
      };
      h.Pc = function() {
        return new E("[MAX_NAME]", C);
      };
      h.Oc = function(a) {
        J(p(a), "KeyIndex indexValue must always be a string.");
        return new E(a, C);
      };
      h.toString = function() {
        return ".key";
      };
      var Vd = new Ud;
      function Wd() {}
      ma(Wd, Od);
      h = Wd.prototype;
      h.compare = function(a, b) {
        var c = a.S.Cc(b.S);
        return 0 === c ? Sb(a.name, b.name) : c;
      };
      h.Hc = function() {
        return !0;
      };
      h.xd = function(a, b) {
        return !a.Z(b);
      };
      h.Sc = function() {
        return Qd;
      };
      h.Pc = function() {
        return Xd;
      };
      h.Oc = function(a, b) {
        var c = L(a);
        return new E(b, c);
      };
      h.toString = function() {
        return ".value";
      };
      var Yd = new Wd;
      function Zd() {
        this.Rb = this.na = this.Lb = this.la = this.ia = !1;
        this.ja = 0;
        this.Nb = "";
        this.dc = null;
        this.xb = "";
        this.ac = null;
        this.vb = "";
        this.g = M;
      }
      var $d = new Zd;
      function sd(a) {
        return "" === a.Nb ? a.la : "l" === a.Nb;
      }
      function od(a) {
        J(a.la, "Only valid if start has been set");
        return a.dc;
      }
      function nd(a) {
        J(a.la, "Only valid if start has been set");
        return a.Lb ? a.xb : "[MIN_NAME]";
      }
      function qd(a) {
        J(a.na, "Only valid if end has been set");
        return a.ac;
      }
      function pd(a) {
        J(a.na, "Only valid if end has been set");
        return a.Rb ? a.vb : "[MAX_NAME]";
      }
      function ae(a) {
        var b = new Zd;
        b.ia = a.ia;
        b.ja = a.ja;
        b.la = a.la;
        b.dc = a.dc;
        b.Lb = a.Lb;
        b.xb = a.xb;
        b.na = a.na;
        b.ac = a.ac;
        b.Rb = a.Rb;
        b.vb = a.vb;
        b.g = a.g;
        return b;
      }
      h = Zd.prototype;
      h.Ge = function(a) {
        var b = ae(this);
        b.ia = !0;
        b.ja = a;
        b.Nb = "";
        return b;
      };
      h.He = function(a) {
        var b = ae(this);
        b.ia = !0;
        b.ja = a;
        b.Nb = "l";
        return b;
      };
      h.Ie = function(a) {
        var b = ae(this);
        b.ia = !0;
        b.ja = a;
        b.Nb = "r";
        return b;
      };
      h.Xd = function(a, b) {
        var c = ae(this);
        c.la = !0;
        n(a) || (a = null);
        c.dc = a;
        null != b ? (c.Lb = !0, c.xb = b) : (c.Lb = !1, c.xb = "");
        return c;
      };
      h.qd = function(a, b) {
        var c = ae(this);
        c.na = !0;
        n(a) || (a = null);
        c.ac = a;
        n(b) ? (c.Rb = !0, c.vb = b) : (c.Yg = !1, c.vb = "");
        return c;
      };
      function be(a, b) {
        var c = ae(a);
        c.g = b;
        return c;
      }
      function ce(a) {
        var b = {};
        a.la && (b.sp = a.dc, a.Lb && (b.sn = a.xb));
        a.na && (b.ep = a.ac, a.Rb && (b.en = a.vb));
        if (a.ia) {
          b.l = a.ja;
          var c = a.Nb;
          "" === c && (c = sd(a) ? "l" : "r");
          b.vf = c;
        }
        a.g !== M && (b.i = a.g.toString());
        return b;
      }
      function de(a) {
        return !(a.la || a.na || a.ia);
      }
      function ee(a) {
        var b = {};
        if (de(a) && a.g == M)
          return b;
        var c;
        a.g === M ? c = "$priority" : a.g === Yd ? c = "$value" : (J(a.g instanceof Rd, "Unrecognized index type!"), c = a.g.toString());
        b.orderBy = B(c);
        a.la && (b.startAt = B(a.dc), a.Lb && (b.startAt += "," + B(a.xb)));
        a.na && (b.endAt = B(a.ac), a.Rb && (b.endAt += "," + B(a.vb)));
        a.ia && (sd(a) ? b.limitToFirst = a.ja : b.limitToLast = a.ja);
        return b;
      }
      h.toString = function() {
        return B(ce(this));
      };
      function fe(a, b) {
        this.yd = a;
        this.cc = b;
      }
      fe.prototype.get = function(a) {
        var b = w(this.yd, a);
        if (!b)
          throw Error("No index defined for " + a);
        return b === Pd ? null : b;
      };
      function ge(a, b, c) {
        var d = na(a.yd, function(d, f) {
          var g = w(a.cc, f);
          J(g, "Missing index implementation for " + f);
          if (d === Pd) {
            if (g.Hc(b.S)) {
              for (var k = [],
                  l = c.Wb(Qb),
                  m = H(l); m; )
                m.name != b.name && k.push(m), m = H(l);
              k.push(b);
              return he(k, ud(g));
            }
            return Pd;
          }
          g = c.get(b.name);
          k = d;
          g && (k = k.remove(new E(b.name, g)));
          return k.Na(b, b.S);
        });
        return new fe(d, a.cc);
      }
      function ie(a, b, c) {
        var d = na(a.yd, function(a) {
          if (a === Pd)
            return a;
          var d = c.get(b.name);
          return d ? a.remove(new E(b.name, d)) : a;
        });
        return new fe(d, a.cc);
      }
      var je = new fe({".priority": Pd}, {".priority": M});
      function tc(a, b) {
        this.C = a;
        J(n(this.C) && null !== this.C, "LeafNode shouldn't be created with null/undefined value.");
        this.ba = b || C;
        ke(this.ba);
        this.Bb = null;
      }
      h = tc.prototype;
      h.N = function() {
        return !0;
      };
      h.A = function() {
        return this.ba;
      };
      h.da = function(a) {
        return new tc(this.C, a);
      };
      h.M = function(a) {
        return ".priority" === a ? this.ba : C;
      };
      h.oa = function(a) {
        return a.e() ? this : ".priority" === O(a) ? this.ba : C;
      };
      h.Ha = function() {
        return !1;
      };
      h.qf = function() {
        return null;
      };
      h.Q = function(a, b) {
        return ".priority" === a ? this.da(b) : b.e() && ".priority" !== a ? this : C.Q(a, b).da(this.ba);
      };
      h.G = function(a, b) {
        var c = O(a);
        if (null === c)
          return b;
        if (b.e() && ".priority" !== c)
          return this;
        J(".priority" !== c || 1 === uc(a), ".priority must be the last token in a path");
        return this.Q(c, C.G(G(a), b));
      };
      h.e = function() {
        return !1;
      };
      h.Db = function() {
        return 0;
      };
      h.K = function(a) {
        return a && !this.A().e() ? {
          ".value": this.Ba(),
          ".priority": this.A().K()
        } : this.Ba();
      };
      h.hash = function() {
        if (null === this.Bb) {
          var a = "";
          this.ba.e() || (a += "priority:" + le(this.ba.K()) + ":");
          var b = typeof this.C,
              a = a + (b + ":"),
              a = "number" === b ? a + Zc(this.C) : a + this.C;
          this.Bb = Jc(a);
        }
        return this.Bb;
      };
      h.Ba = function() {
        return this.C;
      };
      h.Cc = function(a) {
        if (a === C)
          return 1;
        if (a instanceof T)
          return -1;
        J(a.N(), "Unknown node type");
        var b = typeof a.C,
            c = typeof this.C,
            d = Na(me, b),
            e = Na(me, c);
        J(0 <= d, "Unknown leaf type: " + b);
        J(0 <= e, "Unknown leaf type: " + c);
        return d === e ? "object" === c ? 0 : this.C < a.C ? -1 : this.C === a.C ? 0 : 1 : e - d;
      };
      var me = ["object", "boolean", "number", "string"];
      tc.prototype.mb = function() {
        return this;
      };
      tc.prototype.Ic = function() {
        return !0;
      };
      tc.prototype.Z = function(a) {
        return a === this ? !0 : a.N() ? this.C === a.C && this.ba.Z(a.ba) : !1;
      };
      tc.prototype.toString = function() {
        return B(this.K(!0));
      };
      function T(a, b, c) {
        this.m = a;
        (this.ba = b) && ke(this.ba);
        a.e() && J(!this.ba || this.ba.e(), "An empty node cannot have a priority");
        this.wb = c;
        this.Bb = null;
      }
      h = T.prototype;
      h.N = function() {
        return !1;
      };
      h.A = function() {
        return this.ba || C;
      };
      h.da = function(a) {
        return this.m.e() ? this : new T(this.m, a, this.wb);
      };
      h.M = function(a) {
        if (".priority" === a)
          return this.A();
        a = this.m.get(a);
        return null === a ? C : a;
      };
      h.oa = function(a) {
        var b = O(a);
        return null === b ? this : this.M(b).oa(G(a));
      };
      h.Ha = function(a) {
        return null !== this.m.get(a);
      };
      h.Q = function(a, b) {
        J(b, "We should always be passing snapshot nodes");
        if (".priority" === a)
          return this.da(b);
        var c = new E(a, b),
            d,
            e;
        b.e() ? (d = this.m.remove(a), c = ie(this.wb, c, this.m)) : (d = this.m.Na(a, b), c = ge(this.wb, c, this.m));
        e = d.e() ? C : this.ba;
        return new T(d, e, c);
      };
      h.G = function(a, b) {
        var c = O(a);
        if (null === c)
          return b;
        J(".priority" !== O(a) || 1 === uc(a), ".priority must be the last token in a path");
        var d = this.M(c).G(G(a), b);
        return this.Q(c, d);
      };
      h.e = function() {
        return this.m.e();
      };
      h.Db = function() {
        return this.m.count();
      };
      var ne = /^(0|[1-9]\d*)$/;
      h = T.prototype;
      h.K = function(a) {
        if (this.e())
          return null;
        var b = {},
            c = 0,
            d = 0,
            e = !0;
        this.U(M, function(f, g) {
          b[f] = g.K(a);
          c++;
          e && ne.test(f) ? d = Math.max(d, Number(f)) : e = !1;
        });
        if (!a && e && d < 2 * c) {
          var f = [],
              g;
          for (g in b)
            f[g] = b[g];
          return f;
        }
        a && !this.A().e() && (b[".priority"] = this.A().K());
        return b;
      };
      h.hash = function() {
        if (null === this.Bb) {
          var a = "";
          this.A().e() || (a += "priority:" + le(this.A().K()) + ":");
          this.U(M, function(b, c) {
            var d = c.hash();
            "" !== d && (a += ":" + b + ":" + d);
          });
          this.Bb = "" === a ? "" : Jc(a);
        }
        return this.Bb;
      };
      h.qf = function(a, b, c) {
        return (c = oe(this, c)) ? (a = cc(c, new E(a, b))) ? a.name : null : cc(this.m, a);
      };
      function wd(a, b) {
        var c;
        c = (c = oe(a, b)) ? (c = c.Rc()) && c.name : a.m.Rc();
        return c ? new E(c, a.m.get(c)) : null;
      }
      function xd(a, b) {
        var c;
        c = (c = oe(a, b)) ? (c = c.ec()) && c.name : a.m.ec();
        return c ? new E(c, a.m.get(c)) : null;
      }
      h.U = function(a, b) {
        var c = oe(this, a);
        return c ? c.ha(function(a) {
          return b(a.name, a.S);
        }) : this.m.ha(b);
      };
      h.Wb = function(a) {
        return this.Xb(a.Sc(), a);
      };
      h.Xb = function(a, b) {
        var c = oe(this, b);
        if (c)
          return c.Xb(a, function(a) {
            return a;
          });
        for (var c = this.m.Xb(a.name, Qb),
            d = ec(c); null != d && 0 > b.compare(d, a); )
          H(c), d = ec(c);
        return c;
      };
      h.rf = function(a) {
        return this.Zb(a.Pc(), a);
      };
      h.Zb = function(a, b) {
        var c = oe(this, b);
        if (c)
          return c.Zb(a, function(a) {
            return a;
          });
        for (var c = this.m.Zb(a.name, Qb),
            d = ec(c); null != d && 0 < b.compare(d, a); )
          H(c), d = ec(c);
        return c;
      };
      h.Cc = function(a) {
        return this.e() ? a.e() ? 0 : -1 : a.N() || a.e() ? 1 : a === Sd ? -1 : 0;
      };
      h.mb = function(a) {
        if (a === Vd || ta(this.wb.cc, a.toString()))
          return this;
        var b = this.wb,
            c = this.m;
        J(a !== Vd, "KeyIndex always exists and isn't meant to be added to the IndexMap.");
        for (var d = [],
            e = !1,
            c = c.Wb(Qb),
            f = H(c); f; )
          e = e || a.Hc(f.S), d.push(f), f = H(c);
        d = e ? he(d, ud(a)) : Pd;
        e = a.toString();
        c = xa(b.cc);
        c[e] = a;
        a = xa(b.yd);
        a[e] = d;
        return new T(this.m, this.ba, new fe(a, c));
      };
      h.Ic = function(a) {
        return a === Vd || ta(this.wb.cc, a.toString());
      };
      h.Z = function(a) {
        if (a === this)
          return !0;
        if (a.N())
          return !1;
        if (this.A().Z(a.A()) && this.m.count() === a.m.count()) {
          var b = this.Wb(M);
          a = a.Wb(M);
          for (var c = H(b),
              d = H(a); c && d; ) {
            if (c.name !== d.name || !c.S.Z(d.S))
              return !1;
            c = H(b);
            d = H(a);
          }
          return null === c && null === d;
        }
        return !1;
      };
      function oe(a, b) {
        return b === Vd ? null : a.wb.get(b.toString());
      }
      h.toString = function() {
        return B(this.K(!0));
      };
      function L(a, b) {
        if (null === a)
          return C;
        var c = null;
        "object" === typeof a && ".priority" in a ? c = a[".priority"] : "undefined" !== typeof b && (c = b);
        J(null === c || "string" === typeof c || "number" === typeof c || "object" === typeof c && ".sv" in c, "Invalid priority type found: " + typeof c);
        "object" === typeof a && ".value" in a && null !== a[".value"] && (a = a[".value"]);
        if ("object" !== typeof a || ".sv" in a)
          return new tc(a, L(c));
        if (a instanceof Array) {
          var d = C,
              e = a;
          r(e, function(a, b) {
            if (u(e, b) && "." !== b.substring(0, 1)) {
              var c = L(a);
              if (c.N() || !c.e())
                d = d.Q(b, c);
            }
          });
          return d.da(L(c));
        }
        var f = [],
            g = !1,
            k = a;
        hb(k, function(a) {
          if ("string" !== typeof a || "." !== a.substring(0, 1)) {
            var b = L(k[a]);
            b.e() || (g = g || !b.A().e(), f.push(new E(a, b)));
          }
        });
        if (0 == f.length)
          return C;
        var l = he(f, Rb, function(a) {
          return a.name;
        }, Tb);
        if (g) {
          var m = he(f, ud(M));
          return new T(l, L(c), new fe({".priority": m}, {".priority": M}));
        }
        return new T(l, L(c), je);
      }
      var pe = Math.log(2);
      function qe(a) {
        this.count = parseInt(Math.log(a + 1) / pe, 10);
        this.hf = this.count - 1;
        this.bg = a + 1 & parseInt(Array(this.count + 1).join("1"), 2);
      }
      function re(a) {
        var b = !(a.bg & 1 << a.hf);
        a.hf--;
        return b;
      }
      function he(a, b, c, d) {
        function e(b, d) {
          var f = d - b;
          if (0 == f)
            return null;
          if (1 == f) {
            var m = a[b],
                v = c ? c(m) : m;
            return new fc(v, m.S, !1, null, null);
          }
          var m = parseInt(f / 2, 10) + b,
              f = e(b, m),
              y = e(m + 1, d),
              m = a[m],
              v = c ? c(m) : m;
          return new fc(v, m.S, !1, f, y);
        }
        a.sort(b);
        var f = function(b) {
          function d(b, g) {
            var k = v - b,
                y = v;
            v -= b;
            var y = e(k + 1, y),
                k = a[k],
                I = c ? c(k) : k,
                y = new fc(I, k.S, g, null, y);
            f ? f.left = y : m = y;
            f = y;
          }
          for (var f = null,
              m = null,
              v = a.length,
              y = 0; y < b.count; ++y) {
            var I = re(b),
                vd = Math.pow(2, b.count - (y + 1));
            I ? d(vd, !1) : (d(vd, !1), d(vd, !0));
          }
          return m;
        }(new qe(a.length));
        return null !== f ? new ac(d || b, f) : new ac(d || b);
      }
      function le(a) {
        return "number" === typeof a ? "number:" + Zc(a) : "string:" + a;
      }
      function ke(a) {
        if (a.N()) {
          var b = a.K();
          J("string" === typeof b || "number" === typeof b || "object" === typeof b && u(b, ".sv"), "Priority must be a string or number.");
        } else
          J(a === Sd || a.e(), "priority of unexpected type.");
        J(a === Sd || a.A().e(), "Priority nodes can't have a priority of their own.");
      }
      var C = new T(new ac(Tb), null, je);
      function se() {
        T.call(this, new ac(Tb), C, je);
      }
      ma(se, T);
      h = se.prototype;
      h.Cc = function(a) {
        return a === this ? 0 : 1;
      };
      h.Z = function(a) {
        return a === this;
      };
      h.A = function() {
        return this;
      };
      h.M = function() {
        return C;
      };
      h.e = function() {
        return !1;
      };
      var Sd = new se,
          Qd = new E("[MIN_NAME]", C),
          Xd = new E("[MAX_NAME]", Sd);
      function Id(a, b) {
        this.D = a;
        this.Ud = b;
      }
      function Fd(a, b, c, d) {
        return new Id(new sb(b, c, d), a.Ud);
      }
      function Jd(a) {
        return a.D.$ ? a.D.j() : null;
      }
      Id.prototype.u = function() {
        return this.Ud;
      };
      function tb(a) {
        return a.Ud.$ ? a.Ud.j() : null;
      }
      ;
      function te(a, b) {
        this.V = a;
        var c = a.n,
            d = new ld(c.g),
            c = de(c) ? new ld(c.g) : c.ia ? new rd(c) : new md(c);
        this.Gf = new zd(c);
        var e = b.u(),
            f = b.D,
            g = d.ta(C, e.j(), null),
            k = c.ta(C, f.j(), null);
        this.Ka = new Id(new sb(k, f.$, c.Ga()), new sb(g, e.$, d.Ga()));
        this.Za = [];
        this.ig = new dd(a);
      }
      function ue(a) {
        return a.V;
      }
      h = te.prototype;
      h.u = function() {
        return this.Ka.u().j();
      };
      h.hb = function(a) {
        var b = tb(this.Ka);
        return b && (de(this.V.n) || !a.e() && !b.M(O(a)).e()) ? b.oa(a) : null;
      };
      h.e = function() {
        return 0 === this.Za.length;
      };
      h.Ob = function(a) {
        this.Za.push(a);
      };
      h.kb = function(a, b) {
        var c = [];
        if (b) {
          J(null == a, "A cancel should cancel all event registrations.");
          var d = this.V.path;
          Oa(this.Za, function(a) {
            (a = a.ff(b, d)) && c.push(a);
          });
        }
        if (a) {
          for (var e = [],
              f = 0; f < this.Za.length; ++f) {
            var g = this.Za[f];
            if (!g.matches(a))
              e.push(g);
            else if (a.sf()) {
              e = e.concat(this.Za.slice(f + 1));
              break;
            }
          }
          this.Za = e;
        } else
          this.Za = [];
        return c;
      };
      h.bb = function(a, b, c) {
        a.type === Cd && null !== a.source.Ib && (J(tb(this.Ka), "We should always have a full cache before handling merges"), J(Jd(this.Ka), "Missing event cache, even though we have a server cache"));
        var d = this.Ka;
        a = this.Gf.bb(d, a, b, c);
        b = this.Gf;
        c = a.he;
        J(c.D.j().Ic(b.I.g), "Event snap not indexed");
        J(c.u().j().Ic(b.I.g), "Server snap not indexed");
        J(Hb(a.he.u()) || !Hb(d.u()), "Once a server snap is complete, it should never go back");
        this.Ka = a.he;
        return ve(this, a.cg, a.he.D.j(), null);
      };
      function we(a, b) {
        var c = a.Ka.D,
            d = [];
        c.j().N() || c.j().U(M, function(a, b) {
          d.push(new D("child_added", b, a));
        });
        c.$ && d.push(Db(c.j()));
        return ve(a, d, c.j(), b);
      }
      function ve(a, b, c, d) {
        return ed(a.ig, b, c, d ? [d] : a.Za);
      }
      ;
      function xe(a, b, c) {
        this.type = Cd;
        this.source = a;
        this.path = b;
        this.children = c;
      }
      xe.prototype.Wc = function(a) {
        if (this.path.e())
          return a = this.children.subtree(new K(a)), a.e() ? null : a.value ? new Ub(this.source, F, a.value) : new xe(this.source, F, a);
        J(O(this.path) === a, "Can't get a merge for a child not on the path of the operation");
        return new xe(this.source, G(this.path), this.children);
      };
      xe.prototype.toString = function() {
        return "Operation(" + this.path + ": " + this.source.toString() + " merge: " + this.children.toString() + ")";
      };
      var Vb = 0,
          Cd = 1,
          Xb = 2,
          $b = 3;
      function ye(a, b, c, d) {
        this.ve = a;
        this.of = b;
        this.Ib = c;
        this.af = d;
        J(!d || b, "Tagged queries must be from server.");
      }
      var Yb = new ye(!0, !1, null, !1),
          ze = new ye(!1, !0, null, !1);
      ye.prototype.toString = function() {
        return this.ve ? "user" : this.af ? "server(queryID=" + this.Ib + ")" : "server";
      };
      function Ae(a, b) {
        this.f = Oc("p:rest:");
        this.H = a;
        this.Gb = b;
        this.Fa = null;
        this.aa = {};
      }
      function Be(a, b) {
        if (n(b))
          return "tag$" + b;
        var c = a.n;
        J(de(c) && c.g == M, "should have a tag if it's not a default query.");
        return a.path.toString();
      }
      h = Ae.prototype;
      h.xf = function(a, b, c, d) {
        var e = a.path.toString();
        this.f("Listen called for " + e + " " + a.wa());
        var f = Be(a, c),
            g = {};
        this.aa[f] = g;
        a = ee(a.n);
        var k = this;
        Ce(this, e + ".json", a, function(a, b) {
          var v = b;
          404 === a && (a = v = null);
          null === a && k.Gb(e, v, !1, c);
          w(k.aa, f) === g && d(a ? 401 == a ? "permission_denied" : "rest_error:" + a : "ok", null);
        });
      };
      h.Of = function(a, b) {
        var c = Be(a, b);
        delete this.aa[c];
      };
      h.P = function(a, b) {
        this.Fa = a;
        var c = ad(a),
            d = c.data,
            c = c.Ac && c.Ac.exp;
        b && b("ok", {
          auth: d,
          expires: c
        });
      };
      h.ee = function(a) {
        this.Fa = null;
        a("ok", null);
      };
      h.Le = function() {};
      h.Bf = function() {};
      h.Gd = function() {};
      h.put = function() {};
      h.yf = function() {};
      h.Te = function() {};
      function Ce(a, b, c, d) {
        c = c || {};
        c.format = "export";
        a.Fa && (c.auth = a.Fa);
        var e = (a.H.lb ? "https://" : "http://") + a.H.host + b + "?" + jb(c);
        a.f("Sending REST request for " + e);
        var f = new XMLHttpRequest;
        f.onreadystatechange = function() {
          if (d && 4 === f.readyState) {
            a.f("REST Response for " + e + " received. status:", f.status, "response:", f.responseText);
            var b = null;
            if (200 <= f.status && 300 > f.status) {
              try {
                b = mb(f.responseText);
              } catch (c) {
                Q("Failed to parse JSON response for " + e + ": " + f.responseText);
              }
              d(null, b);
            } else
              401 !== f.status && 404 !== f.status && Q("Got unsuccessful REST response for " + e + " Status: " + f.status), d(f.status);
            d = null;
          }
        };
        f.open("GET", e, !0);
        f.send();
      }
      ;
      function De(a, b) {
        this.value = a;
        this.children = b || Ee;
      }
      var Ee = new ac(function(a, b) {
        return a === b ? 0 : a < b ? -1 : 1;
      });
      function Fe(a) {
        var b = Nd;
        r(a, function(a, d) {
          b = b.set(new K(d), a);
        });
        return b;
      }
      h = De.prototype;
      h.e = function() {
        return null === this.value && this.children.e();
      };
      function Ge(a, b, c) {
        if (null != a.value && c(a.value))
          return {
            path: F,
            value: a.value
          };
        if (b.e())
          return null;
        var d = O(b);
        a = a.children.get(d);
        return null !== a ? (b = Ge(a, G(b), c), null != b ? {
          path: (new K(d)).w(b.path),
          value: b.value
        } : null) : null;
      }
      function He(a, b) {
        return Ge(a, b, function() {
          return !0;
        });
      }
      h.subtree = function(a) {
        if (a.e())
          return this;
        var b = this.children.get(O(a));
        return null !== b ? b.subtree(G(a)) : Nd;
      };
      h.set = function(a, b) {
        if (a.e())
          return new De(b, this.children);
        var c = O(a),
            d = (this.children.get(c) || Nd).set(G(a), b),
            c = this.children.Na(c, d);
        return new De(this.value, c);
      };
      h.remove = function(a) {
        if (a.e())
          return this.children.e() ? Nd : new De(null, this.children);
        var b = O(a),
            c = this.children.get(b);
        return c ? (a = c.remove(G(a)), b = a.e() ? this.children.remove(b) : this.children.Na(b, a), null === this.value && b.e() ? Nd : new De(this.value, b)) : this;
      };
      h.get = function(a) {
        if (a.e())
          return this.value;
        var b = this.children.get(O(a));
        return b ? b.get(G(a)) : null;
      };
      function Md(a, b, c) {
        if (b.e())
          return c;
        var d = O(b);
        b = Md(a.children.get(d) || Nd, G(b), c);
        d = b.e() ? a.children.remove(d) : a.children.Na(d, b);
        return new De(a.value, d);
      }
      function Ie(a, b) {
        return Je(a, F, b);
      }
      function Je(a, b, c) {
        var d = {};
        a.children.ha(function(a, f) {
          d[a] = Je(f, b.w(a), c);
        });
        return c(b, a.value, d);
      }
      function Ke(a, b, c) {
        return Le(a, b, F, c);
      }
      function Le(a, b, c, d) {
        var e = a.value ? d(c, a.value) : !1;
        if (e)
          return e;
        if (b.e())
          return null;
        e = O(b);
        return (a = a.children.get(e)) ? Le(a, G(b), c.w(e), d) : null;
      }
      function Me(a, b, c) {
        var d = F;
        if (!b.e()) {
          var e = !0;
          a.value && (e = c(d, a.value));
          !0 === e && (e = O(b), (a = a.children.get(e)) && Ne(a, G(b), d.w(e), c));
        }
      }
      function Ne(a, b, c, d) {
        if (b.e())
          return a;
        a.value && d(c, a.value);
        var e = O(b);
        return (a = a.children.get(e)) ? Ne(a, G(b), c.w(e), d) : Nd;
      }
      function Kd(a, b) {
        Oe(a, F, b);
      }
      function Oe(a, b, c) {
        a.children.ha(function(a, e) {
          Oe(e, b.w(a), c);
        });
        a.value && c(b, a.value);
      }
      function Pe(a, b) {
        a.children.ha(function(a, d) {
          d.value && b(a, d.value);
        });
      }
      var Nd = new De(null);
      De.prototype.toString = function() {
        var a = {};
        Kd(this, function(b, c) {
          a[b.toString()] = c.toString();
        });
        return B(a);
      };
      function Qe(a) {
        this.W = a;
      }
      var Re = new Qe(new De(null));
      function Se(a, b, c) {
        if (b.e())
          return new Qe(new De(c));
        var d = He(a.W, b);
        if (null != d) {
          var e = d.path,
              d = d.value;
          b = N(e, b);
          d = d.G(b, c);
          return new Qe(a.W.set(e, d));
        }
        a = Md(a.W, b, new De(c));
        return new Qe(a);
      }
      function Te(a, b, c) {
        var d = a;
        hb(c, function(a, c) {
          d = Se(d, b.w(a), c);
        });
        return d;
      }
      Qe.prototype.Od = function(a) {
        if (a.e())
          return Re;
        a = Md(this.W, a, Nd);
        return new Qe(a);
      };
      function Ue(a, b) {
        var c = He(a.W, b);
        return null != c ? a.W.get(c.path).oa(N(c.path, b)) : null;
      }
      function Ve(a) {
        var b = [],
            c = a.W.value;
        null != c ? c.N() || c.U(M, function(a, c) {
          b.push(new E(a, c));
        }) : a.W.children.ha(function(a, c) {
          null != c.value && b.push(new E(a, c.value));
        });
        return b;
      }
      function We(a, b) {
        if (b.e())
          return a;
        var c = Ue(a, b);
        return null != c ? new Qe(new De(c)) : new Qe(a.W.subtree(b));
      }
      Qe.prototype.e = function() {
        return this.W.e();
      };
      Qe.prototype.apply = function(a) {
        return Xe(F, this.W, a);
      };
      function Xe(a, b, c) {
        if (null != b.value)
          return c.G(a, b.value);
        var d = null;
        b.children.ha(function(b, f) {
          ".priority" === b ? (J(null !== f.value, "Priority writes must always be leaf nodes"), d = f.value) : c = Xe(a.w(b), f, c);
        });
        c.oa(a).e() || null === d || (c = c.G(a.w(".priority"), d));
        return c;
      }
      ;
      function Ye() {
        this.T = Re;
        this.za = [];
        this.Lc = -1;
      }
      h = Ye.prototype;
      h.Od = function(a) {
        var b = Ua(this.za, function(b) {
          return b.ie === a;
        });
        J(0 <= b, "removeWrite called with nonexistent writeId.");
        var c = this.za[b];
        this.za.splice(b, 1);
        for (var d = c.visible,
            e = !1,
            f = this.za.length - 1; d && 0 <= f; ) {
          var g = this.za[f];
          g.visible && (f >= b && Ze(g, c.path) ? d = !1 : c.path.contains(g.path) && (e = !0));
          f--;
        }
        if (d) {
          if (e)
            this.T = $e(this.za, af, F), this.Lc = 0 < this.za.length ? this.za[this.za.length - 1].ie : -1;
          else if (c.Ia)
            this.T = this.T.Od(c.path);
          else {
            var k = this;
            r(c.children, function(a, b) {
              k.T = k.T.Od(c.path.w(b));
            });
          }
          return c.path;
        }
        return null;
      };
      h.ua = function(a, b, c, d) {
        if (c || d) {
          var e = We(this.T, a);
          return !d && e.e() ? b : d || null != b || null != Ue(e, F) ? (e = $e(this.za, function(b) {
            return (b.visible || d) && (!c || !(0 <= Na(c, b.ie))) && (b.path.contains(a) || a.contains(b.path));
          }, a), b = b || C, e.apply(b)) : null;
        }
        e = Ue(this.T, a);
        if (null != e)
          return e;
        e = We(this.T, a);
        return e.e() ? b : null != b || null != Ue(e, F) ? (b = b || C, e.apply(b)) : null;
      };
      h.xc = function(a, b) {
        var c = C,
            d = Ue(this.T, a);
        if (d)
          d.N() || d.U(M, function(a, b) {
            c = c.Q(a, b);
          });
        else if (b) {
          var e = We(this.T, a);
          b.U(M, function(a, b) {
            var d = We(e, new K(a)).apply(b);
            c = c.Q(a, d);
          });
          Oa(Ve(e), function(a) {
            c = c.Q(a.name, a.S);
          });
        } else
          e = We(this.T, a), Oa(Ve(e), function(a) {
            c = c.Q(a.name, a.S);
          });
        return c;
      };
      h.hd = function(a, b, c, d) {
        J(c || d, "Either existingEventSnap or existingServerSnap must exist");
        a = a.w(b);
        if (null != Ue(this.T, a))
          return null;
        a = We(this.T, a);
        return a.e() ? d.oa(b) : a.apply(d.oa(b));
      };
      h.Xa = function(a, b, c) {
        a = a.w(b);
        var d = Ue(this.T, a);
        return null != d ? d : rb(c, b) ? We(this.T, a).apply(c.j().M(b)) : null;
      };
      h.sc = function(a) {
        return Ue(this.T, a);
      };
      h.me = function(a, b, c, d, e, f) {
        var g;
        a = We(this.T, a);
        g = Ue(a, F);
        if (null == g)
          if (null != b)
            g = a.apply(b);
          else
            return [];
        g = g.mb(f);
        if (g.e() || g.N())
          return [];
        b = [];
        a = ud(f);
        e = e ? g.Zb(c, f) : g.Xb(c, f);
        for (f = H(e); f && b.length < d; )
          0 !== a(f, c) && b.push(f), f = H(e);
        return b;
      };
      function Ze(a, b) {
        return a.Ia ? a.path.contains(b) : !!ua(a.children, function(c, d) {
          return a.path.w(d).contains(b);
        });
      }
      function af(a) {
        return a.visible;
      }
      function $e(a, b, c) {
        for (var d = Re,
            e = 0; e < a.length; ++e) {
          var f = a[e];
          if (b(f)) {
            var g = f.path;
            if (f.Ia)
              c.contains(g) ? (g = N(c, g), d = Se(d, g, f.Ia)) : g.contains(c) && (g = N(g, c), d = Se(d, F, f.Ia.oa(g)));
            else if (f.children)
              if (c.contains(g))
                g = N(c, g), d = Te(d, g, f.children);
              else {
                if (g.contains(c))
                  if (g = N(g, c), g.e())
                    d = Te(d, F, f.children);
                  else if (f = w(f.children, O(g)))
                    f = f.oa(G(g)), d = Se(d, F, f);
              }
            else
              throw Hc("WriteRecord should have .snap or .children");
          }
        }
        return d;
      }
      function bf(a, b) {
        this.Mb = a;
        this.W = b;
      }
      h = bf.prototype;
      h.ua = function(a, b, c) {
        return this.W.ua(this.Mb, a, b, c);
      };
      h.xc = function(a) {
        return this.W.xc(this.Mb, a);
      };
      h.hd = function(a, b, c) {
        return this.W.hd(this.Mb, a, b, c);
      };
      h.sc = function(a) {
        return this.W.sc(this.Mb.w(a));
      };
      h.me = function(a, b, c, d, e) {
        return this.W.me(this.Mb, a, b, c, d, e);
      };
      h.Xa = function(a, b) {
        return this.W.Xa(this.Mb, a, b);
      };
      h.w = function(a) {
        return new bf(this.Mb.w(a), this.W);
      };
      function cf() {
        this.ya = {};
      }
      h = cf.prototype;
      h.e = function() {
        return wa(this.ya);
      };
      h.bb = function(a, b, c) {
        var d = a.source.Ib;
        if (null !== d)
          return d = w(this.ya, d), J(null != d, "SyncTree gave us an op for an invalid query."), d.bb(a, b, c);
        var e = [];
        r(this.ya, function(d) {
          e = e.concat(d.bb(a, b, c));
        });
        return e;
      };
      h.Ob = function(a, b, c, d, e) {
        var f = a.wa(),
            g = w(this.ya, f);
        if (!g) {
          var g = c.ua(e ? d : null),
              k = !1;
          g ? k = !0 : (g = d instanceof T ? c.xc(d) : C, k = !1);
          g = new te(a, new Id(new sb(g, k, !1), new sb(d, e, !1)));
          this.ya[f] = g;
        }
        g.Ob(b);
        return we(g, b);
      };
      h.kb = function(a, b, c) {
        var d = a.wa(),
            e = [],
            f = [],
            g = null != df(this);
        if ("default" === d) {
          var k = this;
          r(this.ya, function(a, d) {
            f = f.concat(a.kb(b, c));
            a.e() && (delete k.ya[d], de(a.V.n) || e.push(a.V));
          });
        } else {
          var l = w(this.ya, d);
          l && (f = f.concat(l.kb(b, c)), l.e() && (delete this.ya[d], de(l.V.n) || e.push(l.V)));
        }
        g && null == df(this) && e.push(new U(a.k, a.path));
        return {
          Hg: e,
          jg: f
        };
      };
      function ef(a) {
        return Pa(ra(a.ya), function(a) {
          return !de(a.V.n);
        });
      }
      h.hb = function(a) {
        var b = null;
        r(this.ya, function(c) {
          b = b || c.hb(a);
        });
        return b;
      };
      function ff(a, b) {
        if (de(b.n))
          return df(a);
        var c = b.wa();
        return w(a.ya, c);
      }
      function df(a) {
        return va(a.ya, function(a) {
          return de(a.V.n);
        }) || null;
      }
      ;
      function gf(a) {
        this.sa = Nd;
        this.Hb = new Ye;
        this.$e = {};
        this.kc = {};
        this.Mc = a;
      }
      function hf(a, b, c, d, e) {
        var f = a.Hb,
            g = e;
        J(d > f.Lc, "Stacking an older write on top of newer ones");
        n(g) || (g = !0);
        f.za.push({
          path: b,
          Ia: c,
          ie: d,
          visible: g
        });
        g && (f.T = Se(f.T, b, c));
        f.Lc = d;
        return e ? jf(a, new Ub(Yb, b, c)) : [];
      }
      function kf(a, b, c, d) {
        var e = a.Hb;
        J(d > e.Lc, "Stacking an older merge on top of newer ones");
        e.za.push({
          path: b,
          children: c,
          ie: d,
          visible: !0
        });
        e.T = Te(e.T, b, c);
        e.Lc = d;
        c = Fe(c);
        return jf(a, new xe(Yb, b, c));
      }
      function lf(a, b, c) {
        c = c || !1;
        b = a.Hb.Od(b);
        return null == b ? [] : jf(a, new Wb(b, c));
      }
      function mf(a, b, c) {
        c = Fe(c);
        return jf(a, new xe(ze, b, c));
      }
      function nf(a, b, c, d) {
        d = of(a, d);
        if (null != d) {
          var e = pf(d);
          d = e.path;
          e = e.Ib;
          b = N(d, b);
          c = new Ub(new ye(!1, !0, e, !0), b, c);
          return qf(a, d, c);
        }
        return [];
      }
      function rf(a, b, c, d) {
        if (d = of(a, d)) {
          var e = pf(d);
          d = e.path;
          e = e.Ib;
          b = N(d, b);
          c = Fe(c);
          c = new xe(new ye(!1, !0, e, !0), b, c);
          return qf(a, d, c);
        }
        return [];
      }
      gf.prototype.Ob = function(a, b) {
        var c = a.path,
            d = null,
            e = !1;
        Me(this.sa, c, function(a, b) {
          var f = N(a, c);
          d = b.hb(f);
          e = e || null != df(b);
          return !d;
        });
        var f = this.sa.get(c);
        f ? (e = e || null != df(f), d = d || f.hb(F)) : (f = new cf, this.sa = this.sa.set(c, f));
        var g;
        null != d ? g = !0 : (g = !1, d = C, Pe(this.sa.subtree(c), function(a, b) {
          var c = b.hb(F);
          c && (d = d.Q(a, c));
        }));
        var k = null != ff(f, a);
        if (!k && !de(a.n)) {
          var l = sf(a);
          J(!(l in this.kc), "View does not exist, but we have a tag");
          var m = tf++;
          this.kc[l] = m;
          this.$e["_" + m] = l;
        }
        g = f.Ob(a, b, new bf(c, this.Hb), d, g);
        k || e || (f = ff(f, a), g = g.concat(uf(this, a, f)));
        return g;
      };
      gf.prototype.kb = function(a, b, c) {
        var d = a.path,
            e = this.sa.get(d),
            f = [];
        if (e && ("default" === a.wa() || null != ff(e, a))) {
          f = e.kb(a, b, c);
          e.e() && (this.sa = this.sa.remove(d));
          e = f.Hg;
          f = f.jg;
          b = -1 !== Ua(e, function(a) {
            return de(a.n);
          });
          var g = Ke(this.sa, d, function(a, b) {
            return null != df(b);
          });
          if (b && !g && (d = this.sa.subtree(d), !d.e()))
            for (var d = vf(d),
                k = 0; k < d.length; ++k) {
              var l = d[k],
                  m = l.V,
                  l = wf(this, l);
              this.Mc.Xe(m, xf(this, m), l.ud, l.J);
            }
          if (!g && 0 < e.length && !c)
            if (b)
              this.Mc.Zd(a, null);
            else {
              var v = this;
              Oa(e, function(a) {
                a.wa();
                var b = v.kc[sf(a)];
                v.Mc.Zd(a, b);
              });
            }
          yf(this, e);
        }
        return f;
      };
      gf.prototype.ua = function(a, b) {
        var c = this.Hb,
            d = Ke(this.sa, a, function(b, c) {
              var d = N(b, a);
              if (d = c.hb(d))
                return d;
            });
        return c.ua(a, d, b, !0);
      };
      function vf(a) {
        return Ie(a, function(a, c, d) {
          if (c && null != df(c))
            return [df(c)];
          var e = [];
          c && (e = ef(c));
          r(d, function(a) {
            e = e.concat(a);
          });
          return e;
        });
      }
      function yf(a, b) {
        for (var c = 0; c < b.length; ++c) {
          var d = b[c];
          if (!de(d.n)) {
            var d = sf(d),
                e = a.kc[d];
            delete a.kc[d];
            delete a.$e["_" + e];
          }
        }
      }
      function uf(a, b, c) {
        var d = b.path,
            e = xf(a, b);
        c = wf(a, c);
        b = a.Mc.Xe(b, e, c.ud, c.J);
        d = a.sa.subtree(d);
        if (e)
          J(null == df(d.value), "If we're adding a query, it shouldn't be shadowed");
        else
          for (e = Ie(d, function(a, b, c) {
            if (!a.e() && b && null != df(b))
              return [ue(df(b))];
            var d = [];
            b && (d = d.concat(Qa(ef(b), function(a) {
              return a.V;
            })));
            r(c, function(a) {
              d = d.concat(a);
            });
            return d;
          }), d = 0; d < e.length; ++d)
            c = e[d], a.Mc.Zd(c, xf(a, c));
        return b;
      }
      function wf(a, b) {
        var c = b.V,
            d = xf(a, c);
        return {
          ud: function() {
            return (b.u() || C).hash();
          },
          J: function(b) {
            if ("ok" === b) {
              if (d) {
                var f = c.path;
                if (b = of(a, d)) {
                  var g = pf(b);
                  b = g.path;
                  g = g.Ib;
                  f = N(b, f);
                  f = new Zb(new ye(!1, !0, g, !0), f);
                  b = qf(a, b, f);
                } else
                  b = [];
              } else
                b = jf(a, new Zb(ze, c.path));
              return b;
            }
            f = "Unknown Error";
            "too_big" === b ? f = "The data requested exceeds the maximum size that can be accessed with a single request." : "permission_denied" == b ? f = "Client doesn't have permission to access the desired data." : "unavailable" == b && (f = "The service is unavailable");
            f = Error(b + ": " + f);
            f.code = b.toUpperCase();
            return a.kb(c, null, f);
          }
        };
      }
      function sf(a) {
        return a.path.toString() + "$" + a.wa();
      }
      function pf(a) {
        var b = a.indexOf("$");
        J(-1 !== b && b < a.length - 1, "Bad queryKey.");
        return {
          Ib: a.substr(b + 1),
          path: new K(a.substr(0, b))
        };
      }
      function of(a, b) {
        var c = a.$e,
            d = "_" + b;
        return d in c ? c[d] : void 0;
      }
      function xf(a, b) {
        var c = sf(b);
        return w(a.kc, c);
      }
      var tf = 1;
      function qf(a, b, c) {
        var d = a.sa.get(b);
        J(d, "Missing sync point for query tag that we're tracking");
        return d.bb(c, new bf(b, a.Hb), null);
      }
      function jf(a, b) {
        return zf(a, b, a.sa, null, new bf(F, a.Hb));
      }
      function zf(a, b, c, d, e) {
        if (b.path.e())
          return Af(a, b, c, d, e);
        var f = c.get(F);
        null == d && null != f && (d = f.hb(F));
        var g = [],
            k = O(b.path),
            l = b.Wc(k);
        if ((c = c.children.get(k)) && l)
          var m = d ? d.M(k) : null,
              k = e.w(k),
              g = g.concat(zf(a, l, c, m, k));
        f && (g = g.concat(f.bb(b, e, d)));
        return g;
      }
      function Af(a, b, c, d, e) {
        var f = c.get(F);
        null == d && null != f && (d = f.hb(F));
        var g = [];
        c.children.ha(function(c, f) {
          var m = d ? d.M(c) : null,
              v = e.w(c),
              y = b.Wc(c);
          y && (g = g.concat(Af(a, y, f, m, v)));
        });
        f && (g = g.concat(f.bb(b, e, d)));
        return g;
      }
      ;
      function Bf() {
        this.children = {};
        this.kd = 0;
        this.value = null;
      }
      function Cf(a, b, c) {
        this.Dd = a ? a : "";
        this.Yc = b ? b : null;
        this.B = c ? c : new Bf;
      }
      function Df(a, b) {
        for (var c = b instanceof K ? b : new K(b),
            d = a,
            e; null !== (e = O(c)); )
          d = new Cf(e, d, w(d.B.children, e) || new Bf), c = G(c);
        return d;
      }
      h = Cf.prototype;
      h.Ba = function() {
        return this.B.value;
      };
      function Ef(a, b) {
        J("undefined" !== typeof b, "Cannot set value to undefined");
        a.B.value = b;
        Ff(a);
      }
      h.clear = function() {
        this.B.value = null;
        this.B.children = {};
        this.B.kd = 0;
        Ff(this);
      };
      h.td = function() {
        return 0 < this.B.kd;
      };
      h.e = function() {
        return null === this.Ba() && !this.td();
      };
      h.U = function(a) {
        var b = this;
        r(this.B.children, function(c, d) {
          a(new Cf(d, b, c));
        });
      };
      function Gf(a, b, c, d) {
        c && !d && b(a);
        a.U(function(a) {
          Gf(a, b, !0, d);
        });
        c && d && b(a);
      }
      function Hf(a, b) {
        for (var c = a.parent(); null !== c && !b(c); )
          c = c.parent();
      }
      h.path = function() {
        return new K(null === this.Yc ? this.Dd : this.Yc.path() + "/" + this.Dd);
      };
      h.name = function() {
        return this.Dd;
      };
      h.parent = function() {
        return this.Yc;
      };
      function Ff(a) {
        if (null !== a.Yc) {
          var b = a.Yc,
              c = a.Dd,
              d = a.e(),
              e = u(b.B.children, c);
          d && e ? (delete b.B.children[c], b.B.kd--, Ff(b)) : d || e || (b.B.children[c] = a.B, b.B.kd++, Ff(b));
        }
      }
      ;
      function If(a) {
        J(ea(a) && 0 < a.length, "Requires a non-empty array");
        this.Uf = a;
        this.Nc = {};
      }
      If.prototype.de = function(a, b) {
        for (var c = this.Nc[a] || [],
            d = 0; d < c.length; d++)
          c[d].yc.apply(c[d].Ma, Array.prototype.slice.call(arguments, 1));
      };
      If.prototype.Eb = function(a, b, c) {
        Jf(this, a);
        this.Nc[a] = this.Nc[a] || [];
        this.Nc[a].push({
          yc: b,
          Ma: c
        });
        (a = this.ze(a)) && b.apply(c, a);
      };
      If.prototype.gc = function(a, b, c) {
        Jf(this, a);
        a = this.Nc[a] || [];
        for (var d = 0; d < a.length; d++)
          if (a[d].yc === b && (!c || c === a[d].Ma)) {
            a.splice(d, 1);
            break;
          }
      };
      function Jf(a, b) {
        J(Ta(a.Uf, function(a) {
          return a === b;
        }), "Unknown event: " + b);
      }
      ;
      var Kf = function() {
        var a = 0,
            b = [];
        return function(c) {
          var d = c === a;
          a = c;
          for (var e = Array(8),
              f = 7; 0 <= f; f--)
            e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64), c = Math.floor(c / 64);
          J(0 === c, "Cannot push at time == 0");
          c = e.join("");
          if (d) {
            for (f = 11; 0 <= f && 63 === b[f]; f--)
              b[f] = 0;
            b[f]++;
          } else
            for (f = 0; 12 > f; f++)
              b[f] = Math.floor(64 * Math.random());
          for (f = 0; 12 > f; f++)
            c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
          J(20 === c.length, "nextPushId: Length should be 20.");
          return c;
        };
      }();
      function Lf() {
        If.call(this, ["online"]);
        this.ic = !0;
        if ("undefined" !== typeof window && "undefined" !== typeof window.addEventListener) {
          var a = this;
          window.addEventListener("online", function() {
            a.ic || (a.ic = !0, a.de("online", !0));
          }, !1);
          window.addEventListener("offline", function() {
            a.ic && (a.ic = !1, a.de("online", !1));
          }, !1);
        }
      }
      ma(Lf, If);
      Lf.prototype.ze = function(a) {
        J("online" === a, "Unknown event type: " + a);
        return [this.ic];
      };
      ca(Lf);
      function Mf() {
        If.call(this, ["visible"]);
        var a,
            b;
        "undefined" !== typeof document && "undefined" !== typeof document.addEventListener && ("undefined" !== typeof document.hidden ? (b = "visibilitychange", a = "hidden") : "undefined" !== typeof document.mozHidden ? (b = "mozvisibilitychange", a = "mozHidden") : "undefined" !== typeof document.msHidden ? (b = "msvisibilitychange", a = "msHidden") : "undefined" !== typeof document.webkitHidden && (b = "webkitvisibilitychange", a = "webkitHidden"));
        this.uc = !0;
        if (b) {
          var c = this;
          document.addEventListener(b, function() {
            var b = !document[a];
            b !== c.uc && (c.uc = b, c.de("visible", b));
          }, !1);
        }
      }
      ma(Mf, If);
      Mf.prototype.ze = function(a) {
        J("visible" === a, "Unknown event type: " + a);
        return [this.uc];
      };
      ca(Mf);
      var Nf = /[\[\].#$\/\u0000-\u001F\u007F]/,
          Of = /[\[\].#$\u0000-\u001F\u007F]/;
      function Pf(a) {
        return p(a) && 0 !== a.length && !Nf.test(a);
      }
      function Qf(a) {
        return null === a || p(a) || ga(a) && !Sc(a) || ia(a) && u(a, ".sv");
      }
      function Rf(a, b, c, d) {
        d && !n(b) || Sf(z(a, 1, d), b, c);
      }
      function Sf(a, b, c) {
        c instanceof K && (c = new wc(c, a));
        if (!n(b))
          throw Error(a + "contains undefined " + zc(c));
        if (ha(b))
          throw Error(a + "contains a function " + zc(c) + " with contents: " + b.toString());
        if (Sc(b))
          throw Error(a + "contains " + b.toString() + " " + zc(c));
        if (p(b) && b.length > 10485760 / 3 && 10485760 < xc(b))
          throw Error(a + "contains a string greater than 10485760 utf8 bytes " + zc(c) + " ('" + b.substring(0, 50) + "...')");
        if (ia(b)) {
          var d = !1,
              e = !1;
          hb(b, function(b, g) {
            if (".value" === b)
              d = !0;
            else if (".priority" !== b && ".sv" !== b && (e = !0, !Pf(b)))
              throw Error(a + " contains an invalid key (" + b + ") " + zc(c) + '.  Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');
            c.push(b);
            Sf(a, g, c);
            c.pop();
          });
          if (d && e)
            throw Error(a + ' contains ".value" child ' + zc(c) + " in addition to actual children.");
        }
      }
      function Tf(a, b, c) {
        if (!ia(b) || ea(b))
          throw Error(z(a, 1, !1) + " must be an Object containing the children to replace.");
        if (u(b, ".value"))
          throw Error(z(a, 1, !1) + ' must not contain ".value".  To overwrite with a leaf value, just use .set() instead.');
        Rf(a, b, c, !1);
      }
      function Uf(a, b, c) {
        if (Sc(c))
          throw Error(z(a, b, !1) + "is " + c.toString() + ", but must be a valid Firebase priority (a string, finite number, server value, or null).");
        if (!Qf(c))
          throw Error(z(a, b, !1) + "must be a valid Firebase priority (a string, finite number, server value, or null).");
      }
      function Vf(a, b, c) {
        if (!c || n(b))
          switch (b) {
            case "value":
            case "child_added":
            case "child_removed":
            case "child_changed":
            case "child_moved":
              break;
            default:
              throw Error(z(a, 1, c) + 'must be a valid event type: "value", "child_added", "child_removed", "child_changed", or "child_moved".');
          }
      }
      function Wf(a, b, c, d) {
        if ((!d || n(c)) && !Pf(c))
          throw Error(z(a, b, d) + 'was an invalid key: "' + c + '".  Firebase keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]").');
      }
      function Xf(a, b) {
        if (!p(b) || 0 === b.length || Of.test(b))
          throw Error(z(a, 1, !1) + 'was an invalid path: "' + b + '". Paths must be non-empty strings and can\'t contain ".", "#", "$", "[", or "]"');
      }
      function Yf(a, b) {
        if (".info" === O(b))
          throw Error(a + " failed: Can't modify data under /.info/");
      }
      function Zf(a, b) {
        if (!p(b))
          throw Error(z(a, 1, !1) + "must be a valid credential (a string).");
      }
      function $f(a, b, c) {
        if (!p(c))
          throw Error(z(a, b, !1) + "must be a valid string.");
      }
      function ag(a, b, c, d) {
        if (!d || n(c))
          if (!ia(c) || null === c)
            throw Error(z(a, b, d) + "must be a valid object.");
      }
      function bg(a, b, c) {
        if (!ia(b) || null === b || !u(b, c))
          throw Error(z(a, 1, !1) + 'must contain the key "' + c + '"');
        if (!p(w(b, c)))
          throw Error(z(a, 1, !1) + 'must contain the key "' + c + '" with type "string"');
      }
      ;
      function cg() {
        this.set = {};
      }
      h = cg.prototype;
      h.add = function(a, b) {
        this.set[a] = null !== b ? b : !0;
      };
      h.contains = function(a) {
        return u(this.set, a);
      };
      h.get = function(a) {
        return this.contains(a) ? this.set[a] : void 0;
      };
      h.remove = function(a) {
        delete this.set[a];
      };
      h.clear = function() {
        this.set = {};
      };
      h.e = function() {
        return wa(this.set);
      };
      h.count = function() {
        return pa(this.set);
      };
      function dg(a, b) {
        r(a.set, function(a, d) {
          b(d, a);
        });
      }
      h.keys = function() {
        var a = [];
        r(this.set, function(b, c) {
          a.push(c);
        });
        return a;
      };
      function qc() {
        this.m = this.C = null;
      }
      qc.prototype.find = function(a) {
        if (null != this.C)
          return this.C.oa(a);
        if (a.e() || null == this.m)
          return null;
        var b = O(a);
        a = G(a);
        return this.m.contains(b) ? this.m.get(b).find(a) : null;
      };
      qc.prototype.mc = function(a, b) {
        if (a.e())
          this.C = b, this.m = null;
        else if (null !== this.C)
          this.C = this.C.G(a, b);
        else {
          null == this.m && (this.m = new cg);
          var c = O(a);
          this.m.contains(c) || this.m.add(c, new qc);
          c = this.m.get(c);
          a = G(a);
          c.mc(a, b);
        }
      };
      function eg(a, b) {
        if (b.e())
          return a.C = null, a.m = null, !0;
        if (null !== a.C) {
          if (a.C.N())
            return !1;
          var c = a.C;
          a.C = null;
          c.U(M, function(b, c) {
            a.mc(new K(b), c);
          });
          return eg(a, b);
        }
        return null !== a.m ? (c = O(b), b = G(b), a.m.contains(c) && eg(a.m.get(c), b) && a.m.remove(c), a.m.e() ? (a.m = null, !0) : !1) : !0;
      }
      function rc(a, b, c) {
        null !== a.C ? c(b, a.C) : a.U(function(a, e) {
          var f = new K(b.toString() + "/" + a);
          rc(e, f, c);
        });
      }
      qc.prototype.U = function(a) {
        null !== this.m && dg(this.m, function(b, c) {
          a(b, c);
        });
      };
      var fg = "auth.firebase.com";
      function gg(a, b, c) {
        this.ld = a || {};
        this.ce = b || {};
        this.ab = c || {};
        this.ld.remember || (this.ld.remember = "default");
      }
      var hg = ["remember", "redirectTo"];
      function ig(a) {
        var b = {},
            c = {};
        hb(a || {}, function(a, e) {
          0 <= Na(hg, a) ? b[a] = e : c[a] = e;
        });
        return new gg(b, {}, c);
      }
      ;
      function jg(a, b) {
        this.Pe = ["session", a.Ld, a.Cb].join(":");
        this.$d = b;
      }
      jg.prototype.set = function(a, b) {
        if (!b)
          if (this.$d.length)
            b = this.$d[0];
          else
            throw Error("fb.login.SessionManager : No storage options available!");
        b.set(this.Pe, a);
      };
      jg.prototype.get = function() {
        var a = Qa(this.$d, q(this.ng, this)),
            a = Pa(a, function(a) {
              return null !== a;
            });
        Xa(a, function(a, c) {
          return bd(c.token) - bd(a.token);
        });
        return 0 < a.length ? a.shift() : null;
      };
      jg.prototype.ng = function(a) {
        try {
          var b = a.get(this.Pe);
          if (b && b.token)
            return b;
        } catch (c) {}
        return null;
      };
      jg.prototype.clear = function() {
        var a = this;
        Oa(this.$d, function(b) {
          b.remove(a.Pe);
        });
      };
      function kg() {
        return "undefined" !== typeof window && !!(window.cordova || window.phonegap || window.PhoneGap) && /ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(navigator.userAgent);
      }
      function lg() {
        return "undefined" !== typeof location && /^file:\//.test(location.href);
      }
      function mg() {
        if ("undefined" === typeof navigator)
          return !1;
        var a = navigator.userAgent;
        if ("Microsoft Internet Explorer" === navigator.appName) {
          if ((a = a.match(/MSIE ([0-9]{1,}[\.0-9]{0,})/)) && 1 < a.length)
            return 8 <= parseFloat(a[1]);
        } else if (-1 < a.indexOf("Trident") && (a = a.match(/rv:([0-9]{2,2}[\.0-9]{0,})/)) && 1 < a.length)
          return 8 <= parseFloat(a[1]);
        return !1;
      }
      ;
      function ng() {
        var a = window.opener.frames,
            b;
        for (b = a.length - 1; 0 <= b; b--)
          try {
            if (a[b].location.protocol === window.location.protocol && a[b].location.host === window.location.host && "__winchan_relay_frame" === a[b].name)
              return a[b];
          } catch (c) {}
        return null;
      }
      function og(a, b, c) {
        a.attachEvent ? a.attachEvent("on" + b, c) : a.addEventListener && a.addEventListener(b, c, !1);
      }
      function pg(a, b, c) {
        a.detachEvent ? a.detachEvent("on" + b, c) : a.removeEventListener && a.removeEventListener(b, c, !1);
      }
      function qg(a) {
        /^https?:\/\//.test(a) || (a = window.location.href);
        var b = /^(https?:\/\/[\-_a-zA-Z\.0-9:]+)/.exec(a);
        return b ? b[1] : a;
      }
      function rg(a) {
        var b = "";
        try {
          a = a.replace("#", "");
          var c = kb(a);
          c && u(c, "__firebase_request_key") && (b = w(c, "__firebase_request_key"));
        } catch (d) {}
        return b;
      }
      function sg() {
        var a = Rc(fg);
        return a.scheme + "://" + a.host + "/v2";
      }
      function tg(a) {
        return sg() + "/" + a + "/auth/channel";
      }
      ;
      function ug(a) {
        var b = this;
        this.zc = a;
        this.ae = "*";
        mg() ? this.Qc = this.wd = ng() : (this.Qc = window.opener, this.wd = window);
        if (!b.Qc)
          throw "Unable to find relay frame";
        og(this.wd, "message", q(this.hc, this));
        og(this.wd, "message", q(this.Af, this));
        try {
          vg(this, {a: "ready"});
        } catch (c) {
          og(this.Qc, "load", function() {
            vg(b, {a: "ready"});
          });
        }
        og(window, "unload", q(this.yg, this));
      }
      function vg(a, b) {
        b = B(b);
        mg() ? a.Qc.doPost(b, a.ae) : a.Qc.postMessage(b, a.ae);
      }
      ug.prototype.hc = function(a) {
        var b = this,
            c;
        try {
          c = mb(a.data);
        } catch (d) {}
        c && "request" === c.a && (pg(window, "message", this.hc), this.ae = a.origin, this.zc && setTimeout(function() {
          b.zc(b.ae, c.d, function(a, c) {
            b.ag = !c;
            b.zc = void 0;
            vg(b, {
              a: "response",
              d: a,
              forceKeepWindowOpen: c
            });
          });
        }, 0));
      };
      ug.prototype.yg = function() {
        try {
          pg(this.wd, "message", this.Af);
        } catch (a) {}
        this.zc && (vg(this, {
          a: "error",
          d: "unknown closed window"
        }), this.zc = void 0);
        try {
          window.close();
        } catch (b) {}
      };
      ug.prototype.Af = function(a) {
        if (this.ag && "die" === a.data)
          try {
            window.close();
          } catch (b) {}
      };
      function wg(a) {
        this.oc = Ga() + Ga() + Ga();
        this.Df = a;
      }
      wg.prototype.open = function(a, b) {
        P.set("redirect_request_id", this.oc);
        P.set("redirect_request_id", this.oc);
        b.requestId = this.oc;
        b.redirectTo = b.redirectTo || window.location.href;
        a += (/\?/.test(a) ? "" : "?") + jb(b);
        window.location = a;
      };
      wg.isAvailable = function() {
        return !lg() && !kg();
      };
      wg.prototype.Bc = function() {
        return "redirect";
      };
      var xg = {
        NETWORK_ERROR: "Unable to contact the Firebase server.",
        SERVER_ERROR: "An unknown server error occurred.",
        TRANSPORT_UNAVAILABLE: "There are no login transports available for the requested method.",
        REQUEST_INTERRUPTED: "The browser redirected the page before the login request could complete.",
        USER_CANCELLED: "The user cancelled authentication."
      };
      function yg(a) {
        var b = Error(w(xg, a), a);
        b.code = a;
        return b;
      }
      ;
      function zg(a) {
        if (!a.window_features || "undefined" !== typeof navigator && (-1 !== navigator.userAgent.indexOf("Fennec/") || -1 !== navigator.userAgent.indexOf("Firefox/") && -1 !== navigator.userAgent.indexOf("Android")))
          a.window_features = void 0;
        a.window_name || (a.window_name = "_blank");
        this.options = a;
      }
      zg.prototype.open = function(a, b, c) {
        function d(a) {
          g && (document.body.removeChild(g), g = void 0);
          v && (v = clearInterval(v));
          pg(window, "message", e);
          pg(window, "unload", d);
          if (m && !a)
            try {
              m.close();
            } catch (b) {
              k.postMessage("die", l);
            }
          m = k = void 0;
        }
        function e(a) {
          if (a.origin === l)
            try {
              var b = mb(a.data);
              "ready" === b.a ? k.postMessage(y, l) : "error" === b.a ? (d(!1), c && (c(b.d), c = null)) : "response" === b.a && (d(b.forceKeepWindowOpen), c && (c(null, b.d), c = null));
            } catch (e) {}
        }
        var f = mg(),
            g,
            k;
        if (!this.options.relay_url)
          return c(Error("invalid arguments: origin of url and relay_url must match"));
        var l = qg(a);
        if (l !== qg(this.options.relay_url))
          c && setTimeout(function() {
            c(Error("invalid arguments: origin of url and relay_url must match"));
          }, 0);
        else {
          f && (g = document.createElement("iframe"), g.setAttribute("src", this.options.relay_url), g.style.display = "none", g.setAttribute("name", "__winchan_relay_frame"), document.body.appendChild(g), k = g.contentWindow);
          a += (/\?/.test(a) ? "" : "?") + jb(b);
          var m = window.open(a, this.options.window_name, this.options.window_features);
          k || (k = m);
          var v = setInterval(function() {
            m && m.closed && (d(!1), c && (c(yg("USER_CANCELLED")), c = null));
          }, 500),
              y = B({
                a: "request",
                d: b
              });
          og(window, "unload", d);
          og(window, "message", e);
        }
      };
      zg.isAvailable = function() {
        return "postMessage" in window && !lg() && !(kg() || "undefined" !== typeof navigator && (navigator.userAgent.match(/Windows Phone/) || window.Windows && /^ms-appx:/.test(location.href)) || "undefined" !== typeof navigator && "undefined" !== typeof window && (navigator.userAgent.match(/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i) || navigator.userAgent.match(/CriOS/) || navigator.userAgent.match(/Twitter for iPhone/) || navigator.userAgent.match(/FBAN\/FBIOS/) || window.navigator.standalone)) && !("undefined" !== typeof navigator && navigator.userAgent.match(/PhantomJS/));
      };
      zg.prototype.Bc = function() {
        return "popup";
      };
      function Ag(a) {
        a.method || (a.method = "GET");
        a.headers || (a.headers = {});
        a.headers.content_type || (a.headers.content_type = "application/json");
        a.headers.content_type = a.headers.content_type.toLowerCase();
        this.options = a;
      }
      Ag.prototype.open = function(a, b, c) {
        function d() {
          c && (c(yg("REQUEST_INTERRUPTED")), c = null);
        }
        var e = new XMLHttpRequest,
            f = this.options.method.toUpperCase(),
            g;
        og(window, "beforeunload", d);
        e.onreadystatechange = function() {
          if (c && 4 === e.readyState) {
            var a;
            if (200 <= e.status && 300 > e.status) {
              try {
                a = mb(e.responseText);
              } catch (b) {}
              c(null, a);
            } else
              500 <= e.status && 600 > e.status ? c(yg("SERVER_ERROR")) : c(yg("NETWORK_ERROR"));
            c = null;
            pg(window, "beforeunload", d);
          }
        };
        if ("GET" === f)
          a += (/\?/.test(a) ? "" : "?") + jb(b), g = null;
        else {
          var k = this.options.headers.content_type;
          "application/json" === k && (g = B(b));
          "application/x-www-form-urlencoded" === k && (g = jb(b));
        }
        e.open(f, a, !0);
        a = {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json;text/plain"
        };
        za(a, this.options.headers);
        for (var l in a)
          e.setRequestHeader(l, a[l]);
        e.send(g);
      };
      Ag.isAvailable = function() {
        return !!window.XMLHttpRequest && "string" === typeof(new XMLHttpRequest).responseType && (!("undefined" !== typeof navigator && (navigator.userAgent.match(/MSIE/) || navigator.userAgent.match(/Trident/))) || mg());
      };
      Ag.prototype.Bc = function() {
        return "json";
      };
      function Bg(a) {
        this.oc = Ga() + Ga() + Ga();
        this.Df = a;
      }
      Bg.prototype.open = function(a, b, c) {
        function d() {
          c && (c(yg("USER_CANCELLED")), c = null);
        }
        var e = this,
            f = Rc(fg),
            g;
        b.requestId = this.oc;
        b.redirectTo = f.scheme + "://" + f.host + "/blank/page.html";
        a += /\?/.test(a) ? "" : "?";
        a += jb(b);
        (g = window.open(a, "_blank", "location=no")) && ha(g.addEventListener) ? (g.addEventListener("loadstart", function(a) {
          var b;
          if (b = a && a.url)
            a: {
              try {
                var m = document.createElement("a");
                m.href = a.url;
                b = m.host === f.host && "/blank/page.html" === m.pathname;
                break a;
              } catch (v) {}
              b = !1;
            }
          b && (a = rg(a.url), g.removeEventListener("exit", d), g.close(), a = new gg(null, null, {
            requestId: e.oc,
            requestKey: a
          }), e.Df.requestWithCredential("/auth/session", a, c), c = null);
        }), g.addEventListener("exit", d)) : c(yg("TRANSPORT_UNAVAILABLE"));
      };
      Bg.isAvailable = function() {
        return kg();
      };
      Bg.prototype.Bc = function() {
        return "redirect";
      };
      function Cg(a) {
        a.callback_parameter || (a.callback_parameter = "callback");
        this.options = a;
        window.__firebase_auth_jsonp = window.__firebase_auth_jsonp || {};
      }
      Cg.prototype.open = function(a, b, c) {
        function d() {
          c && (c(yg("REQUEST_INTERRUPTED")), c = null);
        }
        function e() {
          setTimeout(function() {
            window.__firebase_auth_jsonp[f] = void 0;
            wa(window.__firebase_auth_jsonp) && (window.__firebase_auth_jsonp = void 0);
            try {
              var a = document.getElementById(f);
              a && a.parentNode.removeChild(a);
            } catch (b) {}
          }, 1);
          pg(window, "beforeunload", d);
        }
        var f = "fn" + (new Date).getTime() + Math.floor(99999 * Math.random());
        b[this.options.callback_parameter] = "__firebase_auth_jsonp." + f;
        a += (/\?/.test(a) ? "" : "?") + jb(b);
        og(window, "beforeunload", d);
        window.__firebase_auth_jsonp[f] = function(a) {
          c && (c(null, a), c = null);
          e();
        };
        Dg(f, a, c);
      };
      function Dg(a, b, c) {
        setTimeout(function() {
          try {
            var d = document.createElement("script");
            d.type = "text/javascript";
            d.id = a;
            d.async = !0;
            d.src = b;
            d.onerror = function() {
              var b = document.getElementById(a);
              null !== b && b.parentNode.removeChild(b);
              c && c(yg("NETWORK_ERROR"));
            };
            var e = document.getElementsByTagName("head");
            (e && 0 != e.length ? e[0] : document.documentElement).appendChild(d);
          } catch (f) {
            c && c(yg("NETWORK_ERROR"));
          }
        }, 0);
      }
      Cg.isAvailable = function() {
        return !0;
      };
      Cg.prototype.Bc = function() {
        return "json";
      };
      function Eg(a, b, c, d) {
        If.call(this, ["auth_status"]);
        this.H = a;
        this.df = b;
        this.Sg = c;
        this.Ke = d;
        this.rc = new jg(a, [Dc, P]);
        this.nb = null;
        this.Re = !1;
        Fg(this);
      }
      ma(Eg, If);
      h = Eg.prototype;
      h.we = function() {
        return this.nb || null;
      };
      function Fg(a) {
        P.get("redirect_request_id") && Gg(a);
        var b = a.rc.get();
        b && b.token ? (Hg(a, b), a.df(b.token, function(c, d) {
          Ig(a, c, d, !1, b.token, b);
        }, function(b, d) {
          Jg(a, "resumeSession()", b, d);
        })) : Hg(a, null);
      }
      function Kg(a, b, c, d, e, f) {
        "firebaseio-demo.com" === a.H.domain && Q("Firebase authentication is not supported on demo Firebases (*.firebaseio-demo.com). To secure your Firebase, create a production Firebase at https://www.firebase.com.");
        a.df(b, function(f, k) {
          Ig(a, f, k, !0, b, c, d || {}, e);
        }, function(b, c) {
          Jg(a, "auth()", b, c, f);
        });
      }
      function Lg(a, b) {
        a.rc.clear();
        Hg(a, null);
        a.Sg(function(a, d) {
          if ("ok" === a)
            R(b, null);
          else {
            var e = (a || "error").toUpperCase(),
                f = e;
            d && (f += ": " + d);
            f = Error(f);
            f.code = e;
            R(b, f);
          }
        });
      }
      function Ig(a, b, c, d, e, f, g, k) {
        "ok" === b ? (d && (b = c.auth, f.auth = b, f.expires = c.expires, f.token = cd(e) ? e : "", c = null, b && u(b, "uid") ? c = w(b, "uid") : u(f, "uid") && (c = w(f, "uid")), f.uid = c, c = "custom", b && u(b, "provider") ? c = w(b, "provider") : u(f, "provider") && (c = w(f, "provider")), f.provider = c, a.rc.clear(), cd(e) && (g = g || {}, c = Dc, "sessionOnly" === g.remember && (c = P), "none" !== g.remember && a.rc.set(f, c)), Hg(a, f)), R(k, null, f)) : (a.rc.clear(), Hg(a, null), f = a = (b || "error").toUpperCase(), c && (f += ": " + c), f = Error(f), f.code = a, R(k, f));
      }
      function Jg(a, b, c, d, e) {
        Q(b + " was canceled: " + d);
        a.rc.clear();
        Hg(a, null);
        a = Error(d);
        a.code = c.toUpperCase();
        R(e, a);
      }
      function Mg(a, b, c, d, e) {
        Ng(a);
        c = new gg(d || {}, {}, c || {});
        Og(a, [Ag, Cg], "/auth/" + b, c, e);
      }
      function Pg(a, b, c, d) {
        Ng(a);
        var e = [zg, Bg];
        c = ig(c);
        "anonymous" === b || "password" === b ? setTimeout(function() {
          R(d, yg("TRANSPORT_UNAVAILABLE"));
        }, 0) : (c.ce.window_features = "menubar=yes,modal=yes,alwaysRaised=yeslocation=yes,resizable=yes,scrollbars=yes,status=yes,height=625,width=625,top=" + ("object" === typeof screen ? .5 * (screen.height - 625) : 0) + ",left=" + ("object" === typeof screen ? .5 * (screen.width - 625) : 0), c.ce.relay_url = tg(a.H.Cb), c.ce.requestWithCredential = q(a.pc, a), Og(a, e, "/auth/" + b, c, d));
      }
      function Gg(a) {
        var b = P.get("redirect_request_id");
        if (b) {
          var c = P.get("redirect_client_options");
          P.remove("redirect_request_id");
          P.remove("redirect_client_options");
          var d = [Ag, Cg],
              b = {
                requestId: b,
                requestKey: rg(document.location.hash)
              },
              c = new gg(c, {}, b);
          a.Re = !0;
          try {
            document.location.hash = document.location.hash.replace(/&__firebase_request_key=([a-zA-z0-9]*)/, "");
          } catch (e) {}
          Og(a, d, "/auth/session", c, function() {
            this.Re = !1;
          }.bind(a));
        }
      }
      h.re = function(a, b) {
        Ng(this);
        var c = ig(a);
        c.ab._method = "POST";
        this.pc("/users", c, function(a, c) {
          a ? R(b, a) : R(b, a, c);
        });
      };
      h.Se = function(a, b) {
        var c = this;
        Ng(this);
        var d = "/users/" + encodeURIComponent(a.email),
            e = ig(a);
        e.ab._method = "DELETE";
        this.pc(d, e, function(a, d) {
          !a && d && d.uid && c.nb && c.nb.uid && c.nb.uid === d.uid && Lg(c);
          R(b, a);
        });
      };
      h.oe = function(a, b) {
        Ng(this);
        var c = "/users/" + encodeURIComponent(a.email) + "/password",
            d = ig(a);
        d.ab._method = "PUT";
        d.ab.password = a.newPassword;
        this.pc(c, d, function(a) {
          R(b, a);
        });
      };
      h.ne = function(a, b) {
        Ng(this);
        var c = "/users/" + encodeURIComponent(a.oldEmail) + "/email",
            d = ig(a);
        d.ab._method = "PUT";
        d.ab.email = a.newEmail;
        d.ab.password = a.password;
        this.pc(c, d, function(a) {
          R(b, a);
        });
      };
      h.Ue = function(a, b) {
        Ng(this);
        var c = "/users/" + encodeURIComponent(a.email) + "/password",
            d = ig(a);
        d.ab._method = "POST";
        this.pc(c, d, function(a) {
          R(b, a);
        });
      };
      h.pc = function(a, b, c) {
        Qg(this, [Ag, Cg], a, b, c);
      };
      function Og(a, b, c, d, e) {
        Qg(a, b, c, d, function(b, c) {
          !b && c && c.token && c.uid ? Kg(a, c.token, c, d.ld, function(a, b) {
            a ? R(e, a) : R(e, null, b);
          }) : R(e, b || yg("UNKNOWN_ERROR"));
        });
      }
      function Qg(a, b, c, d, e) {
        b = Pa(b, function(a) {
          return "function" === typeof a.isAvailable && a.isAvailable();
        });
        0 === b.length ? setTimeout(function() {
          R(e, yg("TRANSPORT_UNAVAILABLE"));
        }, 0) : (b = new (b.shift())(d.ce), d = ib(d.ab), d.v = "js-2.2.4", d.transport = b.Bc(), d.suppress_status_codes = !0, a = sg() + "/" + a.H.Cb + c, b.open(a, d, function(a, b) {
          if (a)
            R(e, a);
          else if (b && b.error) {
            var c = Error(b.error.message);
            c.code = b.error.code;
            c.details = b.error.details;
            R(e, c);
          } else
            R(e, null, b);
        }));
      }
      function Hg(a, b) {
        var c = null !== a.nb || null !== b;
        a.nb = b;
        c && a.de("auth_status", b);
        a.Ke(null !== b);
      }
      h.ze = function(a) {
        J("auth_status" === a, 'initial event must be of type "auth_status"');
        return this.Re ? null : [this.nb];
      };
      function Ng(a) {
        var b = a.H;
        if ("firebaseio.com" !== b.domain && "firebaseio-demo.com" !== b.domain && "auth.firebase.com" === fg)
          throw Error("This custom Firebase server ('" + a.H.domain + "') does not support delegated login.");
      }
      ;
      function Rg(a) {
        this.hc = a;
        this.Kd = [];
        this.Qb = 0;
        this.pe = -1;
        this.Fb = null;
      }
      function Sg(a, b, c) {
        a.pe = b;
        a.Fb = c;
        a.pe < a.Qb && (a.Fb(), a.Fb = null);
      }
      function Tg(a, b, c) {
        for (a.Kd[b] = c; a.Kd[a.Qb]; ) {
          var d = a.Kd[a.Qb];
          delete a.Kd[a.Qb];
          for (var e = 0; e < d.length; ++e)
            if (d[e]) {
              var f = a;
              Cb(function() {
                f.hc(d[e]);
              });
            }
          if (a.Qb === a.pe) {
            a.Fb && (clearTimeout(a.Fb), a.Fb(), a.Fb = null);
            break;
          }
          a.Qb++;
        }
      }
      ;
      function Ug(a, b, c) {
        this.qe = a;
        this.f = Oc(a);
        this.ob = this.pb = 0;
        this.Va = Ob(b);
        this.Vd = c;
        this.Gc = !1;
        this.gd = function(a) {
          b.host !== b.Oa && (a.ns = b.Cb);
          var c = [],
              f;
          for (f in a)
            a.hasOwnProperty(f) && c.push(f + "=" + a[f]);
          return (b.lb ? "https://" : "http://") + b.Oa + "/.lp?" + c.join("&");
        };
      }
      var Vg,
          Wg;
      Ug.prototype.open = function(a, b) {
        this.gf = 0;
        this.ka = b;
        this.zf = new Rg(a);
        this.zb = !1;
        var c = this;
        this.rb = setTimeout(function() {
          c.f("Timed out trying to connect.");
          c.ib();
          c.rb = null;
        }, Math.floor(3E4));
        Tc(function() {
          if (!c.zb) {
            c.Ta = new Xg(function(a, b, d, k, l) {
              Yg(c, arguments);
              if (c.Ta)
                if (c.rb && (clearTimeout(c.rb), c.rb = null), c.Gc = !0, "start" == a)
                  c.id = b, c.Ff = d;
                else if ("close" === a)
                  b ? (c.Ta.Td = !1, Sg(c.zf, b, function() {
                    c.ib();
                  })) : c.ib();
                else
                  throw Error("Unrecognized command received: " + a);
            }, function(a, b) {
              Yg(c, arguments);
              Tg(c.zf, a, b);
            }, function() {
              c.ib();
            }, c.gd);
            var a = {start: "t"};
            a.ser = Math.floor(1E8 * Math.random());
            c.Ta.fe && (a.cb = c.Ta.fe);
            a.v = "5";
            c.Vd && (a.s = c.Vd);
            "undefined" !== typeof location && location.href && -1 !== location.href.indexOf("firebaseio.com") && (a.r = "f");
            a = c.gd(a);
            c.f("Connecting via long-poll to " + a);
            Zg(c.Ta, a, function() {});
          }
        });
      };
      Ug.prototype.start = function() {
        var a = this.Ta,
            b = this.Ff;
        a.rg = this.id;
        a.sg = b;
        for (a.ke = !0; $g(a); )
          ;
        a = this.id;
        b = this.Ff;
        this.fc = document.createElement("iframe");
        var c = {dframe: "t"};
        c.id = a;
        c.pw = b;
        this.fc.src = this.gd(c);
        this.fc.style.display = "none";
        document.body.appendChild(this.fc);
      };
      Ug.isAvailable = function() {
        return !Wg && !("object" === typeof window && window.chrome && window.chrome.extension && !/^chrome/.test(window.location.href)) && !("object" === typeof Windows && "object" === typeof Windows.Ug) && (Vg || !0);
      };
      h = Ug.prototype;
      h.Bd = function() {};
      h.cd = function() {
        this.zb = !0;
        this.Ta && (this.Ta.close(), this.Ta = null);
        this.fc && (document.body.removeChild(this.fc), this.fc = null);
        this.rb && (clearTimeout(this.rb), this.rb = null);
      };
      h.ib = function() {
        this.zb || (this.f("Longpoll is closing itself"), this.cd(), this.ka && (this.ka(this.Gc), this.ka = null));
      };
      h.close = function() {
        this.zb || (this.f("Longpoll is being closed."), this.cd());
      };
      h.send = function(a) {
        a = B(a);
        this.pb += a.length;
        Lb(this.Va, "bytes_sent", a.length);
        a = Kc(a);
        a = fb(a, !0);
        a = Xc(a, 1840);
        for (var b = 0; b < a.length; b++) {
          var c = this.Ta;
          c.$c.push({
            Jg: this.gf,
            Rg: a.length,
            jf: a[b]
          });
          c.ke && $g(c);
          this.gf++;
        }
      };
      function Yg(a, b) {
        var c = B(b).length;
        a.ob += c;
        Lb(a.Va, "bytes_received", c);
      }
      function Xg(a, b, c, d) {
        this.gd = d;
        this.jb = c;
        this.Oe = new cg;
        this.$c = [];
        this.se = Math.floor(1E8 * Math.random());
        this.Td = !0;
        this.fe = Gc();
        window["pLPCommand" + this.fe] = a;
        window["pRTLPCB" + this.fe] = b;
        a = document.createElement("iframe");
        a.style.display = "none";
        if (document.body) {
          document.body.appendChild(a);
          try {
            a.contentWindow.document || Bb("No IE domain setting required");
          } catch (e) {
            a.src = "javascript:void((function(){document.open();document.domain='" + document.domain + "';document.close();})())";
          }
        } else
          throw "Document body has not initialized. Wait to initialize Firebase until after the document is ready.";
        a.contentDocument ? a.gb = a.contentDocument : a.contentWindow ? a.gb = a.contentWindow.document : a.document && (a.gb = a.document);
        this.Ca = a;
        a = "";
        this.Ca.src && "javascript:" === this.Ca.src.substr(0, 11) && (a = '<script>document.domain="' + document.domain + '";\x3c/script>');
        a = "<html><body>" + a + "</body></html>";
        try {
          this.Ca.gb.open(), this.Ca.gb.write(a), this.Ca.gb.close();
        } catch (f) {
          Bb("frame writing exception"), f.stack && Bb(f.stack), Bb(f);
        }
      }
      Xg.prototype.close = function() {
        this.ke = !1;
        if (this.Ca) {
          this.Ca.gb.body.innerHTML = "";
          var a = this;
          setTimeout(function() {
            null !== a.Ca && (document.body.removeChild(a.Ca), a.Ca = null);
          }, Math.floor(0));
        }
        var b = this.jb;
        b && (this.jb = null, b());
      };
      function $g(a) {
        if (a.ke && a.Td && a.Oe.count() < (0 < a.$c.length ? 2 : 1)) {
          a.se++;
          var b = {};
          b.id = a.rg;
          b.pw = a.sg;
          b.ser = a.se;
          for (var b = a.gd(b),
              c = "",
              d = 0; 0 < a.$c.length; )
            if (1870 >= a.$c[0].jf.length + 30 + c.length) {
              var e = a.$c.shift(),
                  c = c + "&seg" + d + "=" + e.Jg + "&ts" + d + "=" + e.Rg + "&d" + d + "=" + e.jf;
              d++;
            } else
              break;
          ah(a, b + c, a.se);
          return !0;
        }
        return !1;
      }
      function ah(a, b, c) {
        function d() {
          a.Oe.remove(c);
          $g(a);
        }
        a.Oe.add(c, 1);
        var e = setTimeout(d, Math.floor(25E3));
        Zg(a, b, function() {
          clearTimeout(e);
          d();
        });
      }
      function Zg(a, b, c) {
        setTimeout(function() {
          try {
            if (a.Td) {
              var d = a.Ca.gb.createElement("script");
              d.type = "text/javascript";
              d.async = !0;
              d.src = b;
              d.onload = d.onreadystatechange = function() {
                var a = d.readyState;
                a && "loaded" !== a && "complete" !== a || (d.onload = d.onreadystatechange = null, d.parentNode && d.parentNode.removeChild(d), c());
              };
              d.onerror = function() {
                Bb("Long-poll script failed to load: " + b);
                a.Td = !1;
                a.close();
              };
              a.Ca.gb.body.appendChild(d);
            }
          } catch (e) {}
        }, Math.floor(1));
      }
      ;
      var bh = null;
      "undefined" !== typeof MozWebSocket ? bh = MozWebSocket : "undefined" !== typeof WebSocket && (bh = WebSocket);
      function ch(a, b, c) {
        this.qe = a;
        this.f = Oc(this.qe);
        this.frames = this.Jc = null;
        this.ob = this.pb = this.bf = 0;
        this.Va = Ob(b);
        this.fb = (b.lb ? "wss://" : "ws://") + b.Oa + "/.ws?v=5";
        "undefined" !== typeof location && location.href && -1 !== location.href.indexOf("firebaseio.com") && (this.fb += "&r=f");
        b.host !== b.Oa && (this.fb = this.fb + "&ns=" + b.Cb);
        c && (this.fb = this.fb + "&s=" + c);
      }
      var dh;
      ch.prototype.open = function(a, b) {
        this.jb = b;
        this.wg = a;
        this.f("Websocket connecting to " + this.fb);
        this.Gc = !1;
        Dc.set("previous_websocket_failure", !0);
        try {
          this.va = new bh(this.fb);
        } catch (c) {
          this.f("Error instantiating WebSocket.");
          var d = c.message || c.data;
          d && this.f(d);
          this.ib();
          return ;
        }
        var e = this;
        this.va.onopen = function() {
          e.f("Websocket connected.");
          e.Gc = !0;
        };
        this.va.onclose = function() {
          e.f("Websocket connection was disconnected.");
          e.va = null;
          e.ib();
        };
        this.va.onmessage = function(a) {
          if (null !== e.va)
            if (a = a.data, e.ob += a.length, Lb(e.Va, "bytes_received", a.length), eh(e), null !== e.frames)
              fh(e, a);
            else {
              a: {
                J(null === e.frames, "We already have a frame buffer");
                if (6 >= a.length) {
                  var b = Number(a);
                  if (!isNaN(b)) {
                    e.bf = b;
                    e.frames = [];
                    a = null;
                    break a;
                  }
                }
                e.bf = 1;
                e.frames = [];
              }
              null !== a && fh(e, a);
            }
        };
        this.va.onerror = function(a) {
          e.f("WebSocket error.  Closing connection.");
          (a = a.message || a.data) && e.f(a);
          e.ib();
        };
      };
      ch.prototype.start = function() {};
      ch.isAvailable = function() {
        var a = !1;
        if ("undefined" !== typeof navigator && navigator.userAgent) {
          var b = navigator.userAgent.match(/Android ([0-9]{0,}\.[0-9]{0,})/);
          b && 1 < b.length && 4.4 > parseFloat(b[1]) && (a = !0);
        }
        return !a && null !== bh && !dh;
      };
      ch.responsesRequiredToBeHealthy = 2;
      ch.healthyTimeout = 3E4;
      h = ch.prototype;
      h.Bd = function() {
        Dc.remove("previous_websocket_failure");
      };
      function fh(a, b) {
        a.frames.push(b);
        if (a.frames.length == a.bf) {
          var c = a.frames.join("");
          a.frames = null;
          c = mb(c);
          a.wg(c);
        }
      }
      h.send = function(a) {
        eh(this);
        a = B(a);
        this.pb += a.length;
        Lb(this.Va, "bytes_sent", a.length);
        a = Xc(a, 16384);
        1 < a.length && this.va.send(String(a.length));
        for (var b = 0; b < a.length; b++)
          this.va.send(a[b]);
      };
      h.cd = function() {
        this.zb = !0;
        this.Jc && (clearInterval(this.Jc), this.Jc = null);
        this.va && (this.va.close(), this.va = null);
      };
      h.ib = function() {
        this.zb || (this.f("WebSocket is closing itself"), this.cd(), this.jb && (this.jb(this.Gc), this.jb = null));
      };
      h.close = function() {
        this.zb || (this.f("WebSocket is being closed"), this.cd());
      };
      function eh(a) {
        clearInterval(a.Jc);
        a.Jc = setInterval(function() {
          a.va && a.va.send("0");
          eh(a);
        }, Math.floor(45E3));
      }
      ;
      function gh(a) {
        hh(this, a);
      }
      var ih = [Ug, ch];
      function hh(a, b) {
        var c = ch && ch.isAvailable(),
            d = c && !(Dc.uf || !0 === Dc.get("previous_websocket_failure"));
        b.Tg && (c || Q("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."), d = !0);
        if (d)
          a.ed = [ch];
        else {
          var e = a.ed = [];
          Yc(ih, function(a, b) {
            b && b.isAvailable() && e.push(b);
          });
        }
      }
      function jh(a) {
        if (0 < a.ed.length)
          return a.ed[0];
        throw Error("No transports available");
      }
      ;
      function kh(a, b, c, d, e, f) {
        this.id = a;
        this.f = Oc("c:" + this.id + ":");
        this.hc = c;
        this.Vc = d;
        this.ka = e;
        this.Me = f;
        this.H = b;
        this.Jd = [];
        this.ef = 0;
        this.Nf = new gh(b);
        this.Ua = 0;
        this.f("Connection created");
        lh(this);
      }
      function lh(a) {
        var b = jh(a.Nf);
        a.L = new b("c:" + a.id + ":" + a.ef++, a.H);
        a.Qe = b.responsesRequiredToBeHealthy || 0;
        var c = mh(a, a.L),
            d = nh(a, a.L);
        a.fd = a.L;
        a.bd = a.L;
        a.F = null;
        a.Ab = !1;
        setTimeout(function() {
          a.L && a.L.open(c, d);
        }, Math.floor(0));
        b = b.healthyTimeout || 0;
        0 < b && (a.vd = setTimeout(function() {
          a.vd = null;
          a.Ab || (a.L && 102400 < a.L.ob ? (a.f("Connection exceeded healthy timeout but has received " + a.L.ob + " bytes.  Marking connection healthy."), a.Ab = !0, a.L.Bd()) : a.L && 10240 < a.L.pb ? a.f("Connection exceeded healthy timeout but has sent " + a.L.pb + " bytes.  Leaving connection alive.") : (a.f("Closing unhealthy connection after timeout."), a.close()));
        }, Math.floor(b)));
      }
      function nh(a, b) {
        return function(c) {
          b === a.L ? (a.L = null, c || 0 !== a.Ua ? 1 === a.Ua && a.f("Realtime connection lost.") : (a.f("Realtime connection failed."), "s-" === a.H.Oa.substr(0, 2) && (Dc.remove("host:" + a.H.host), a.H.Oa = a.H.host)), a.close()) : b === a.F ? (a.f("Secondary connection lost."), c = a.F, a.F = null, a.fd !== c && a.bd !== c || a.close()) : a.f("closing an old connection");
        };
      }
      function mh(a, b) {
        return function(c) {
          if (2 != a.Ua)
            if (b === a.bd) {
              var d = Vc("t", c);
              c = Vc("d", c);
              if ("c" == d) {
                if (d = Vc("t", c), "d" in c)
                  if (c = c.d, "h" === d) {
                    var d = c.ts,
                        e = c.v,
                        f = c.h;
                    a.Vd = c.s;
                    Fc(a.H, f);
                    0 == a.Ua && (a.L.start(), oh(a, a.L, d), "5" !== e && Q("Protocol version mismatch detected"), c = a.Nf, (c = 1 < c.ed.length ? c.ed[1] : null) && ph(a, c));
                  } else if ("n" === d) {
                    a.f("recvd end transmission on primary");
                    a.bd = a.F;
                    for (c = 0; c < a.Jd.length; ++c)
                      a.Fd(a.Jd[c]);
                    a.Jd = [];
                    qh(a);
                  } else
                    "s" === d ? (a.f("Connection shutdown command received. Shutting down..."), a.Me && (a.Me(c), a.Me = null), a.ka = null, a.close()) : "r" === d ? (a.f("Reset packet received.  New host: " + c), Fc(a.H, c), 1 === a.Ua ? a.close() : (rh(a), lh(a))) : "e" === d ? Pc("Server Error: " + c) : "o" === d ? (a.f("got pong on primary."), sh(a), th(a)) : Pc("Unknown control packet command: " + d);
              } else
                "d" == d && a.Fd(c);
            } else if (b === a.F)
              if (d = Vc("t", c), c = Vc("d", c), "c" == d)
                "t" in c && (c = c.t, "a" === c ? uh(a) : "r" === c ? (a.f("Got a reset on secondary, closing it"), a.F.close(), a.fd !== a.F && a.bd !== a.F || a.close()) : "o" === c && (a.f("got pong on secondary."), a.Lf--, uh(a)));
              else if ("d" == d)
                a.Jd.push(c);
              else
                throw Error("Unknown protocol layer: " + d);
            else
              a.f("message on old connection");
        };
      }
      kh.prototype.Da = function(a) {
        vh(this, {
          t: "d",
          d: a
        });
      };
      function qh(a) {
        a.fd === a.F && a.bd === a.F && (a.f("cleaning up and promoting a connection: " + a.F.qe), a.L = a.F, a.F = null);
      }
      function uh(a) {
        0 >= a.Lf ? (a.f("Secondary connection is healthy."), a.Ab = !0, a.F.Bd(), a.F.start(), a.f("sending client ack on secondary"), a.F.send({
          t: "c",
          d: {
            t: "a",
            d: {}
          }
        }), a.f("Ending transmission on primary"), a.L.send({
          t: "c",
          d: {
            t: "n",
            d: {}
          }
        }), a.fd = a.F, qh(a)) : (a.f("sending ping on secondary."), a.F.send({
          t: "c",
          d: {
            t: "p",
            d: {}
          }
        }));
      }
      kh.prototype.Fd = function(a) {
        sh(this);
        this.hc(a);
      };
      function sh(a) {
        a.Ab || (a.Qe--, 0 >= a.Qe && (a.f("Primary connection is healthy."), a.Ab = !0, a.L.Bd()));
      }
      function ph(a, b) {
        a.F = new b("c:" + a.id + ":" + a.ef++, a.H, a.Vd);
        a.Lf = b.responsesRequiredToBeHealthy || 0;
        a.F.open(mh(a, a.F), nh(a, a.F));
        setTimeout(function() {
          a.F && (a.f("Timed out trying to upgrade."), a.F.close());
        }, Math.floor(6E4));
      }
      function oh(a, b, c) {
        a.f("Realtime connection established.");
        a.L = b;
        a.Ua = 1;
        a.Vc && (a.Vc(c), a.Vc = null);
        0 === a.Qe ? (a.f("Primary connection is healthy."), a.Ab = !0) : setTimeout(function() {
          th(a);
        }, Math.floor(5E3));
      }
      function th(a) {
        a.Ab || 1 !== a.Ua || (a.f("sending ping on primary."), vh(a, {
          t: "c",
          d: {
            t: "p",
            d: {}
          }
        }));
      }
      function vh(a, b) {
        if (1 !== a.Ua)
          throw "Connection is not connected";
        a.fd.send(b);
      }
      kh.prototype.close = function() {
        2 !== this.Ua && (this.f("Closing realtime connection."), this.Ua = 2, rh(this), this.ka && (this.ka(), this.ka = null));
      };
      function rh(a) {
        a.f("Shutting down all connections");
        a.L && (a.L.close(), a.L = null);
        a.F && (a.F.close(), a.F = null);
        a.vd && (clearTimeout(a.vd), a.vd = null);
      }
      ;
      function wh(a, b, c, d) {
        this.id = xh++;
        this.f = Oc("p:" + this.id + ":");
        this.wf = this.De = !1;
        this.aa = {};
        this.pa = [];
        this.Xc = 0;
        this.Uc = [];
        this.ma = !1;
        this.$a = 1E3;
        this.Cd = 3E5;
        this.Gb = b;
        this.Tc = c;
        this.Ne = d;
        this.H = a;
        this.We = null;
        this.Qd = {};
        this.Ig = 0;
        this.mf = !0;
        this.Kc = this.Fe = null;
        yh(this, 0);
        Mf.ub().Eb("visible", this.zg, this);
        -1 === a.host.indexOf("fblocal") && Lf.ub().Eb("online", this.xg, this);
      }
      var xh = 0,
          zh = 0;
      h = wh.prototype;
      h.Da = function(a, b, c) {
        var d = ++this.Ig;
        a = {
          r: d,
          a: a,
          b: b
        };
        this.f(B(a));
        J(this.ma, "sendRequest call when we're not connected not allowed.");
        this.Sa.Da(a);
        c && (this.Qd[d] = c);
      };
      h.xf = function(a, b, c, d) {
        var e = a.wa(),
            f = a.path.toString();
        this.f("Listen called for " + f + " " + e);
        this.aa[f] = this.aa[f] || {};
        J(!this.aa[f][e], "listen() called twice for same path/queryId.");
        a = {
          J: d,
          ud: b,
          Fg: a,
          tag: c
        };
        this.aa[f][e] = a;
        this.ma && Ah(this, a);
      };
      function Ah(a, b) {
        var c = b.Fg,
            d = c.path.toString(),
            e = c.wa();
        a.f("Listen on " + d + " for " + e);
        var f = {p: d};
        b.tag && (f.q = ce(c.n), f.t = b.tag);
        f.h = b.ud();
        a.Da("q", f, function(f) {
          var k = f.d,
              l = f.s;
          if (k && "object" === typeof k && u(k, "w")) {
            var m = w(k, "w");
            ea(m) && 0 <= Na(m, "no_index") && Q("Using an unspecified index. Consider adding " + ('".indexOn": "' + c.n.g.toString() + '"') + " at " + c.path.toString() + " to your security rules for better performance");
          }
          (a.aa[d] && a.aa[d][e]) === b && (a.f("listen response", f), "ok" !== l && Bh(a, d, e), b.J && b.J(l, k));
        });
      }
      h.P = function(a, b, c) {
        this.Fa = {
          fg: a,
          nf: !1,
          yc: b,
          jd: c
        };
        this.f("Authenticating using credential: " + a);
        Ch(this);
        (b = 40 == a.length) || (a = ad(a).Ac, b = "object" === typeof a && !0 === w(a, "admin"));
        b && (this.f("Admin auth credential detected.  Reducing max reconnect time."), this.Cd = 3E4);
      };
      h.ee = function(a) {
        delete this.Fa;
        this.ma && this.Da("unauth", {}, function(b) {
          a(b.s, b.d);
        });
      };
      function Ch(a) {
        var b = a.Fa;
        a.ma && b && a.Da("auth", {cred: b.fg}, function(c) {
          var d = c.s;
          c = c.d || "error";
          "ok" !== d && a.Fa === b && delete a.Fa;
          b.nf ? "ok" !== d && b.jd && b.jd(d, c) : (b.nf = !0, b.yc && b.yc(d, c));
        });
      }
      h.Of = function(a, b) {
        var c = a.path.toString(),
            d = a.wa();
        this.f("Unlisten called for " + c + " " + d);
        if (Bh(this, c, d) && this.ma) {
          var e = ce(a.n);
          this.f("Unlisten on " + c + " for " + d);
          c = {p: c};
          b && (c.q = e, c.t = b);
          this.Da("n", c);
        }
      };
      h.Le = function(a, b, c) {
        this.ma ? Dh(this, "o", a, b, c) : this.Uc.push({
          Zc: a,
          action: "o",
          data: b,
          J: c
        });
      };
      h.Bf = function(a, b, c) {
        this.ma ? Dh(this, "om", a, b, c) : this.Uc.push({
          Zc: a,
          action: "om",
          data: b,
          J: c
        });
      };
      h.Gd = function(a, b) {
        this.ma ? Dh(this, "oc", a, null, b) : this.Uc.push({
          Zc: a,
          action: "oc",
          data: null,
          J: b
        });
      };
      function Dh(a, b, c, d, e) {
        c = {
          p: c,
          d: d
        };
        a.f("onDisconnect " + b, c);
        a.Da(b, c, function(a) {
          e && setTimeout(function() {
            e(a.s, a.d);
          }, Math.floor(0));
        });
      }
      h.put = function(a, b, c, d) {
        Eh(this, "p", a, b, c, d);
      };
      h.yf = function(a, b, c, d) {
        Eh(this, "m", a, b, c, d);
      };
      function Eh(a, b, c, d, e, f) {
        d = {
          p: c,
          d: d
        };
        n(f) && (d.h = f);
        a.pa.push({
          action: b,
          If: d,
          J: e
        });
        a.Xc++;
        b = a.pa.length - 1;
        a.ma ? Fh(a, b) : a.f("Buffering put: " + c);
      }
      function Fh(a, b) {
        var c = a.pa[b].action,
            d = a.pa[b].If,
            e = a.pa[b].J;
        a.pa[b].Gg = a.ma;
        a.Da(c, d, function(d) {
          a.f(c + " response", d);
          delete a.pa[b];
          a.Xc--;
          0 === a.Xc && (a.pa = []);
          e && e(d.s, d.d);
        });
      }
      h.Te = function(a) {
        this.ma && (a = {c: a}, this.f("reportStats", a), this.Da("s", a, function(a) {
          "ok" !== a.s && this.f("reportStats", "Error sending stats: " + a.d);
        }));
      };
      h.Fd = function(a) {
        if ("r" in a) {
          this.f("from server: " + B(a));
          var b = a.r,
              c = this.Qd[b];
          c && (delete this.Qd[b], c(a.b));
        } else {
          if ("error" in a)
            throw "A server-side error has occurred: " + a.error;
          "a" in a && (b = a.a, c = a.b, this.f("handleServerMessage", b, c), "d" === b ? this.Gb(c.p, c.d, !1, c.t) : "m" === b ? this.Gb(c.p, c.d, !0, c.t) : "c" === b ? Gh(this, c.p, c.q) : "ac" === b ? (a = c.s, b = c.d, c = this.Fa, delete this.Fa, c && c.jd && c.jd(a, b)) : "sd" === b ? this.We ? this.We(c) : "msg" in c && "undefined" !== typeof console && console.log("FIREBASE: " + c.msg.replace("\n", "\nFIREBASE: ")) : Pc("Unrecognized action received from server: " + B(b) + "\nAre you using the latest client?"));
        }
      };
      h.Vc = function(a) {
        this.f("connection ready");
        this.ma = !0;
        this.Kc = (new Date).getTime();
        this.Ne({serverTimeOffset: a - (new Date).getTime()});
        this.mf && (a = {}, a["sdk.js." + "2.2.4".replace(/\./g, "-")] = 1, kg() && (a["framework.cordova"] = 1), this.Te(a));
        Hh(this);
        this.mf = !1;
        this.Tc(!0);
      };
      function yh(a, b) {
        J(!a.Sa, "Scheduling a connect when we're already connected/ing?");
        a.Sb && clearTimeout(a.Sb);
        a.Sb = setTimeout(function() {
          a.Sb = null;
          Ih(a);
        }, Math.floor(b));
      }
      h.zg = function(a) {
        a && !this.uc && this.$a === this.Cd && (this.f("Window became visible.  Reducing delay."), this.$a = 1E3, this.Sa || yh(this, 0));
        this.uc = a;
      };
      h.xg = function(a) {
        a ? (this.f("Browser went online."), this.$a = 1E3, this.Sa || yh(this, 0)) : (this.f("Browser went offline.  Killing connection."), this.Sa && this.Sa.close());
      };
      h.Cf = function() {
        this.f("data client disconnected");
        this.ma = !1;
        this.Sa = null;
        for (var a = 0; a < this.pa.length; a++) {
          var b = this.pa[a];
          b && "h" in b.If && b.Gg && (b.J && b.J("disconnect"), delete this.pa[a], this.Xc--);
        }
        0 === this.Xc && (this.pa = []);
        this.Qd = {};
        Jh(this) && (this.uc ? this.Kc && (3E4 < (new Date).getTime() - this.Kc && (this.$a = 1E3), this.Kc = null) : (this.f("Window isn't visible.  Delaying reconnect."), this.$a = this.Cd, this.Fe = (new Date).getTime()), a = Math.max(0, this.$a - ((new Date).getTime() - this.Fe)), a *= Math.random(), this.f("Trying to reconnect in " + a + "ms"), yh(this, a), this.$a = Math.min(this.Cd, 1.3 * this.$a));
        this.Tc(!1);
      };
      function Ih(a) {
        if (Jh(a)) {
          a.f("Making a connection attempt");
          a.Fe = (new Date).getTime();
          a.Kc = null;
          var b = q(a.Fd, a),
              c = q(a.Vc, a),
              d = q(a.Cf, a),
              e = a.id + ":" + zh++;
          a.Sa = new kh(e, a.H, b, c, d, function(b) {
            Q(b + " (" + a.H.toString() + ")");
            a.wf = !0;
          });
        }
      }
      h.yb = function() {
        this.De = !0;
        this.Sa ? this.Sa.close() : (this.Sb && (clearTimeout(this.Sb), this.Sb = null), this.ma && this.Cf());
      };
      h.qc = function() {
        this.De = !1;
        this.$a = 1E3;
        this.Sa || yh(this, 0);
      };
      function Gh(a, b, c) {
        c = c ? Qa(c, function(a) {
          return Wc(a);
        }).join("$") : "default";
        (a = Bh(a, b, c)) && a.J && a.J("permission_denied");
      }
      function Bh(a, b, c) {
        b = (new K(b)).toString();
        var d;
        n(a.aa[b]) ? (d = a.aa[b][c], delete a.aa[b][c], 0 === pa(a.aa[b]) && delete a.aa[b]) : d = void 0;
        return d;
      }
      function Hh(a) {
        Ch(a);
        r(a.aa, function(b) {
          r(b, function(b) {
            Ah(a, b);
          });
        });
        for (var b = 0; b < a.pa.length; b++)
          a.pa[b] && Fh(a, b);
        for (; a.Uc.length; )
          b = a.Uc.shift(), Dh(a, b.action, b.Zc, b.data, b.J);
      }
      function Jh(a) {
        var b;
        b = Lf.ub().ic;
        return !a.wf && !a.De && b;
      }
      ;
      var V = {lg: function() {
          Vg = dh = !0;
        }};
      V.forceLongPolling = V.lg;
      V.mg = function() {
        Wg = !0;
      };
      V.forceWebSockets = V.mg;
      V.Mg = function(a, b) {
        a.k.Ra.We = b;
      };
      V.setSecurityDebugCallback = V.Mg;
      V.Ye = function(a, b) {
        a.k.Ye(b);
      };
      V.stats = V.Ye;
      V.Ze = function(a, b) {
        a.k.Ze(b);
      };
      V.statsIncrementCounter = V.Ze;
      V.pd = function(a) {
        return a.k.pd;
      };
      V.dataUpdateCount = V.pd;
      V.pg = function(a, b) {
        a.k.Ce = b;
      };
      V.interceptServerData = V.pg;
      V.vg = function(a) {
        new ug(a);
      };
      V.onPopupOpen = V.vg;
      V.Kg = function(a) {
        fg = a;
      };
      V.setAuthenticationServer = V.Kg;
      function S(a, b, c) {
        this.B = a;
        this.V = b;
        this.g = c;
      }
      S.prototype.K = function() {
        x("Firebase.DataSnapshot.val", 0, 0, arguments.length);
        return this.B.K();
      };
      S.prototype.val = S.prototype.K;
      S.prototype.lf = function() {
        x("Firebase.DataSnapshot.exportVal", 0, 0, arguments.length);
        return this.B.K(!0);
      };
      S.prototype.exportVal = S.prototype.lf;
      S.prototype.kg = function() {
        x("Firebase.DataSnapshot.exists", 0, 0, arguments.length);
        return !this.B.e();
      };
      S.prototype.exists = S.prototype.kg;
      S.prototype.w = function(a) {
        x("Firebase.DataSnapshot.child", 0, 1, arguments.length);
        ga(a) && (a = String(a));
        Xf("Firebase.DataSnapshot.child", a);
        var b = new K(a),
            c = this.V.w(b);
        return new S(this.B.oa(b), c, M);
      };
      S.prototype.child = S.prototype.w;
      S.prototype.Ha = function(a) {
        x("Firebase.DataSnapshot.hasChild", 1, 1, arguments.length);
        Xf("Firebase.DataSnapshot.hasChild", a);
        var b = new K(a);
        return !this.B.oa(b).e();
      };
      S.prototype.hasChild = S.prototype.Ha;
      S.prototype.A = function() {
        x("Firebase.DataSnapshot.getPriority", 0, 0, arguments.length);
        return this.B.A().K();
      };
      S.prototype.getPriority = S.prototype.A;
      S.prototype.forEach = function(a) {
        x("Firebase.DataSnapshot.forEach", 1, 1, arguments.length);
        A("Firebase.DataSnapshot.forEach", 1, a, !1);
        if (this.B.N())
          return !1;
        var b = this;
        return !!this.B.U(this.g, function(c, d) {
          return a(new S(d, b.V.w(c), M));
        });
      };
      S.prototype.forEach = S.prototype.forEach;
      S.prototype.td = function() {
        x("Firebase.DataSnapshot.hasChildren", 0, 0, arguments.length);
        return this.B.N() ? !1 : !this.B.e();
      };
      S.prototype.hasChildren = S.prototype.td;
      S.prototype.name = function() {
        Q("Firebase.DataSnapshot.name() being deprecated. Please use Firebase.DataSnapshot.key() instead.");
        x("Firebase.DataSnapshot.name", 0, 0, arguments.length);
        return this.key();
      };
      S.prototype.name = S.prototype.name;
      S.prototype.key = function() {
        x("Firebase.DataSnapshot.key", 0, 0, arguments.length);
        return this.V.key();
      };
      S.prototype.key = S.prototype.key;
      S.prototype.Db = function() {
        x("Firebase.DataSnapshot.numChildren", 0, 0, arguments.length);
        return this.B.Db();
      };
      S.prototype.numChildren = S.prototype.Db;
      S.prototype.lc = function() {
        x("Firebase.DataSnapshot.ref", 0, 0, arguments.length);
        return this.V;
      };
      S.prototype.ref = S.prototype.lc;
      function Kh(a, b) {
        this.H = a;
        this.Va = Ob(a);
        this.ea = new ub;
        this.Ed = 1;
        this.Ra = null;
        b || 0 <= ("object" === typeof window && window.navigator && window.navigator.userAgent || "").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i) ? (this.ca = new Ae(this.H, q(this.Gb, this)), setTimeout(q(this.Tc, this, !0), 0)) : this.ca = this.Ra = new wh(this.H, q(this.Gb, this), q(this.Tc, this), q(this.Ne, this));
        this.Pg = Pb(a, q(function() {
          return new Jb(this.Va, this.ca);
        }, this));
        this.tc = new Cf;
        this.Be = new nb;
        var c = this;
        this.zd = new gf({
          Xe: function(a, b, f, g) {
            b = [];
            f = c.Be.j(a.path);
            f.e() || (b = jf(c.zd, new Ub(ze, a.path, f)), setTimeout(function() {
              g("ok");
            }, 0));
            return b;
          },
          Zd: ba
        });
        Lh(this, "connected", !1);
        this.ka = new qc;
        this.P = new Eg(a, q(this.ca.P, this.ca), q(this.ca.ee, this.ca), q(this.Ke, this));
        this.pd = 0;
        this.Ce = null;
        this.O = new gf({
          Xe: function(a, b, f, g) {
            c.ca.xf(a, f, b, function(b, e) {
              var f = g(b, e);
              zb(c.ea, a.path, f);
            });
            return [];
          },
          Zd: function(a, b) {
            c.ca.Of(a, b);
          }
        });
      }
      h = Kh.prototype;
      h.toString = function() {
        return (this.H.lb ? "https://" : "http://") + this.H.host;
      };
      h.name = function() {
        return this.H.Cb;
      };
      function Mh(a) {
        a = a.Be.j(new K(".info/serverTimeOffset")).K() || 0;
        return (new Date).getTime() + a;
      }
      function Nh(a) {
        a = a = {timestamp: Mh(a)};
        a.timestamp = a.timestamp || (new Date).getTime();
        return a;
      }
      h.Gb = function(a, b, c, d) {
        this.pd++;
        var e = new K(a);
        b = this.Ce ? this.Ce(a, b) : b;
        a = [];
        d ? c ? (b = na(b, function(a) {
          return L(a);
        }), a = rf(this.O, e, b, d)) : (b = L(b), a = nf(this.O, e, b, d)) : c ? (d = na(b, function(a) {
          return L(a);
        }), a = mf(this.O, e, d)) : (d = L(b), a = jf(this.O, new Ub(ze, e, d)));
        d = e;
        0 < a.length && (d = Oh(this, e));
        zb(this.ea, d, a);
      };
      h.Tc = function(a) {
        Lh(this, "connected", a);
        !1 === a && Ph(this);
      };
      h.Ne = function(a) {
        var b = this;
        Yc(a, function(a, d) {
          Lh(b, d, a);
        });
      };
      h.Ke = function(a) {
        Lh(this, "authenticated", a);
      };
      function Lh(a, b, c) {
        b = new K("/.info/" + b);
        c = L(c);
        var d = a.Be;
        d.Sd = d.Sd.G(b, c);
        c = jf(a.zd, new Ub(ze, b, c));
        zb(a.ea, b, c);
      }
      h.Kb = function(a, b, c, d) {
        this.f("set", {
          path: a.toString(),
          value: b,
          Xg: c
        });
        var e = Nh(this);
        b = L(b, c);
        var e = sc(b, e),
            f = this.Ed++,
            e = hf(this.O, a, e, f, !0);
        vb(this.ea, e);
        var g = this;
        this.ca.put(a.toString(), b.K(!0), function(b, c) {
          var e = "ok" === b;
          e || Q("set at " + a + " failed: " + b);
          e = lf(g.O, f, !e);
          zb(g.ea, a, e);
          Qh(d, b, c);
        });
        e = Rh(this, a);
        Oh(this, e);
        zb(this.ea, e, []);
      };
      h.update = function(a, b, c) {
        this.f("update", {
          path: a.toString(),
          value: b
        });
        var d = !0,
            e = Nh(this),
            f = {};
        r(b, function(a, b) {
          d = !1;
          var c = L(a);
          f[b] = sc(c, e);
        });
        if (d)
          Bb("update() called with empty data.  Don't do anything."), Qh(c, "ok");
        else {
          var g = this.Ed++,
              k = kf(this.O, a, f, g);
          vb(this.ea, k);
          var l = this;
          this.ca.yf(a.toString(), b, function(b, d) {
            var e = "ok" === b;
            e || Q("update at " + a + " failed: " + b);
            var e = lf(l.O, g, !e),
                f = a;
            0 < e.length && (f = Oh(l, a));
            zb(l.ea, f, e);
            Qh(c, b, d);
          });
          b = Rh(this, a);
          Oh(this, b);
          zb(this.ea, a, []);
        }
      };
      function Ph(a) {
        a.f("onDisconnectEvents");
        var b = Nh(a),
            c = [];
        rc(pc(a.ka, b), F, function(b, e) {
          c = c.concat(jf(a.O, new Ub(ze, b, e)));
          var f = Rh(a, b);
          Oh(a, f);
        });
        a.ka = new qc;
        zb(a.ea, F, c);
      }
      h.Gd = function(a, b) {
        var c = this;
        this.ca.Gd(a.toString(), function(d, e) {
          "ok" === d && eg(c.ka, a);
          Qh(b, d, e);
        });
      };
      function Sh(a, b, c, d) {
        var e = L(c);
        a.ca.Le(b.toString(), e.K(!0), function(c, g) {
          "ok" === c && a.ka.mc(b, e);
          Qh(d, c, g);
        });
      }
      function Th(a, b, c, d, e) {
        var f = L(c, d);
        a.ca.Le(b.toString(), f.K(!0), function(c, d) {
          "ok" === c && a.ka.mc(b, f);
          Qh(e, c, d);
        });
      }
      function Uh(a, b, c, d) {
        var e = !0,
            f;
        for (f in c)
          e = !1;
        e ? (Bb("onDisconnect().update() called with empty data.  Don't do anything."), Qh(d, "ok")) : a.ca.Bf(b.toString(), c, function(e, f) {
          if ("ok" === e)
            for (var l in c) {
              var m = L(c[l]);
              a.ka.mc(b.w(l), m);
            }
          Qh(d, e, f);
        });
      }
      function Vh(a, b, c) {
        c = ".info" === O(b.path) ? a.zd.Ob(b, c) : a.O.Ob(b, c);
        xb(a.ea, b.path, c);
      }
      h.yb = function() {
        this.Ra && this.Ra.yb();
      };
      h.qc = function() {
        this.Ra && this.Ra.qc();
      };
      h.Ye = function(a) {
        if ("undefined" !== typeof console) {
          a ? (this.Yd || (this.Yd = new Ib(this.Va)), a = this.Yd.get()) : a = this.Va.get();
          var b = Ra(sa(a), function(a, b) {
            return Math.max(b.length, a);
          }, 0),
              c;
          for (c in a) {
            for (var d = a[c],
                e = c.length; e < b + 2; e++)
              c += " ";
            console.log(c + d);
          }
        }
      };
      h.Ze = function(a) {
        Lb(this.Va, a);
        this.Pg.Mf[a] = !0;
      };
      h.f = function(a) {
        var b = "";
        this.Ra && (b = this.Ra.id + ":");
        Bb(b, arguments);
      };
      function Qh(a, b, c) {
        a && Cb(function() {
          if ("ok" == b)
            a(null);
          else {
            var d = (b || "error").toUpperCase(),
                e = d;
            c && (e += ": " + c);
            e = Error(e);
            e.code = d;
            a(e);
          }
        });
      }
      ;
      function Wh(a, b, c, d, e) {
        function f() {}
        a.f("transaction on " + b);
        var g = new U(a, b);
        g.Eb("value", f);
        c = {
          path: b,
          update: c,
          J: d,
          status: null,
          Ef: Gc(),
          cf: e,
          Kf: 0,
          ge: function() {
            g.gc("value", f);
          },
          je: null,
          Aa: null,
          md: null,
          nd: null,
          od: null
        };
        d = a.O.ua(b, void 0) || C;
        c.md = d;
        d = c.update(d.K());
        if (n(d)) {
          Sf("transaction failed: Data returned ", d, c.path);
          c.status = 1;
          e = Df(a.tc, b);
          var k = e.Ba() || [];
          k.push(c);
          Ef(e, k);
          "object" === typeof d && null !== d && u(d, ".priority") ? (k = w(d, ".priority"), J(Qf(k), "Invalid priority returned by transaction. Priority must be a valid string, finite number, server value, or null.")) : k = (a.O.ua(b) || C).A().K();
          e = Nh(a);
          d = L(d, k);
          e = sc(d, e);
          c.nd = d;
          c.od = e;
          c.Aa = a.Ed++;
          c = hf(a.O, b, e, c.Aa, c.cf);
          zb(a.ea, b, c);
          Xh(a);
        } else
          c.ge(), c.nd = null, c.od = null, c.J && (a = new S(c.md, new U(a, c.path), M), c.J(null, !1, a));
      }
      function Xh(a, b) {
        var c = b || a.tc;
        b || Yh(a, c);
        if (null !== c.Ba()) {
          var d = Zh(a, c);
          J(0 < d.length, "Sending zero length transaction queue");
          Sa(d, function(a) {
            return 1 === a.status;
          }) && $h(a, c.path(), d);
        } else
          c.td() && c.U(function(b) {
            Xh(a, b);
          });
      }
      function $h(a, b, c) {
        for (var d = Qa(c, function(a) {
          return a.Aa;
        }),
            e = a.O.ua(b, d) || C,
            d = e,
            e = e.hash(),
            f = 0; f < c.length; f++) {
          var g = c[f];
          J(1 === g.status, "tryToSendTransactionQueue_: items in queue should all be run.");
          g.status = 2;
          g.Kf++;
          var k = N(b, g.path),
              d = d.G(k, g.nd);
        }
        d = d.K(!0);
        a.ca.put(b.toString(), d, function(d) {
          a.f("transaction put response", {
            path: b.toString(),
            status: d
          });
          var e = [];
          if ("ok" === d) {
            d = [];
            for (f = 0; f < c.length; f++) {
              c[f].status = 3;
              e = e.concat(lf(a.O, c[f].Aa));
              if (c[f].J) {
                var g = c[f].od,
                    k = new U(a, c[f].path);
                d.push(q(c[f].J, null, null, !0, new S(g, k, M)));
              }
              c[f].ge();
            }
            Yh(a, Df(a.tc, b));
            Xh(a);
            zb(a.ea, b, e);
            for (f = 0; f < d.length; f++)
              Cb(d[f]);
          } else {
            if ("datastale" === d)
              for (f = 0; f < c.length; f++)
                c[f].status = 4 === c[f].status ? 5 : 1;
            else
              for (Q("transaction at " + b.toString() + " failed: " + d), f = 0; f < c.length; f++)
                c[f].status = 5, c[f].je = d;
            Oh(a, b);
          }
        }, e);
      }
      function Oh(a, b) {
        var c = ai(a, b),
            d = c.path(),
            c = Zh(a, c);
        bi(a, c, d);
        return d;
      }
      function bi(a, b, c) {
        if (0 !== b.length) {
          for (var d = [],
              e = [],
              f = Qa(b, function(a) {
                return a.Aa;
              }),
              g = 0; g < b.length; g++) {
            var k = b[g],
                l = N(c, k.path),
                m = !1,
                v;
            J(null !== l, "rerunTransactionsUnderNode_: relativePath should not be null.");
            if (5 === k.status)
              m = !0, v = k.je, e = e.concat(lf(a.O, k.Aa, !0));
            else if (1 === k.status)
              if (25 <= k.Kf)
                m = !0, v = "maxretry", e = e.concat(lf(a.O, k.Aa, !0));
              else {
                var y = a.O.ua(k.path, f) || C;
                k.md = y;
                var I = b[g].update(y.K());
                n(I) ? (Sf("transaction failed: Data returned ", I, k.path), l = L(I), "object" === typeof I && null != I && u(I, ".priority") || (l = l.da(y.A())), y = k.Aa, I = Nh(a), I = sc(l, I), k.nd = l, k.od = I, k.Aa = a.Ed++, Va(f, y), e = e.concat(hf(a.O, k.path, I, k.Aa, k.cf)), e = e.concat(lf(a.O, y, !0))) : (m = !0, v = "nodata", e = e.concat(lf(a.O, k.Aa, !0)));
              }
            zb(a.ea, c, e);
            e = [];
            m && (b[g].status = 3, setTimeout(b[g].ge, Math.floor(0)), b[g].J && ("nodata" === v ? (k = new U(a, b[g].path), d.push(q(b[g].J, null, null, !1, new S(b[g].md, k, M)))) : d.push(q(b[g].J, null, Error(v), !1, null))));
          }
          Yh(a, a.tc);
          for (g = 0; g < d.length; g++)
            Cb(d[g]);
          Xh(a);
        }
      }
      function ai(a, b) {
        for (var c,
            d = a.tc; null !== (c = O(b)) && null === d.Ba(); )
          d = Df(d, c), b = G(b);
        return d;
      }
      function Zh(a, b) {
        var c = [];
        ci(a, b, c);
        c.sort(function(a, b) {
          return a.Ef - b.Ef;
        });
        return c;
      }
      function ci(a, b, c) {
        var d = b.Ba();
        if (null !== d)
          for (var e = 0; e < d.length; e++)
            c.push(d[e]);
        b.U(function(b) {
          ci(a, b, c);
        });
      }
      function Yh(a, b) {
        var c = b.Ba();
        if (c) {
          for (var d = 0,
              e = 0; e < c.length; e++)
            3 !== c[e].status && (c[d] = c[e], d++);
          c.length = d;
          Ef(b, 0 < c.length ? c : null);
        }
        b.U(function(b) {
          Yh(a, b);
        });
      }
      function Rh(a, b) {
        var c = ai(a, b).path(),
            d = Df(a.tc, b);
        Hf(d, function(b) {
          di(a, b);
        });
        di(a, d);
        Gf(d, function(b) {
          di(a, b);
        });
        return c;
      }
      function di(a, b) {
        var c = b.Ba();
        if (null !== c) {
          for (var d = [],
              e = [],
              f = -1,
              g = 0; g < c.length; g++)
            4 !== c[g].status && (2 === c[g].status ? (J(f === g - 1, "All SENT items should be at beginning of queue."), f = g, c[g].status = 4, c[g].je = "set") : (J(1 === c[g].status, "Unexpected transaction status in abort"), c[g].ge(), e = e.concat(lf(a.O, c[g].Aa, !0)), c[g].J && d.push(q(c[g].J, null, Error("set"), !1, null))));
          -1 === f ? Ef(b, null) : c.length = f + 1;
          zb(a.ea, b.path(), e);
          for (g = 0; g < d.length; g++)
            Cb(d[g]);
        }
      }
      ;
      function W() {
        this.nc = {};
        this.Pf = !1;
      }
      ca(W);
      W.prototype.yb = function() {
        for (var a in this.nc)
          this.nc[a].yb();
      };
      W.prototype.interrupt = W.prototype.yb;
      W.prototype.qc = function() {
        for (var a in this.nc)
          this.nc[a].qc();
      };
      W.prototype.resume = W.prototype.qc;
      W.prototype.ue = function() {
        this.Pf = !0;
      };
      function X(a, b) {
        this.ad = a;
        this.qa = b;
      }
      X.prototype.cancel = function(a) {
        x("Firebase.onDisconnect().cancel", 0, 1, arguments.length);
        A("Firebase.onDisconnect().cancel", 1, a, !0);
        this.ad.Gd(this.qa, a || null);
      };
      X.prototype.cancel = X.prototype.cancel;
      X.prototype.remove = function(a) {
        x("Firebase.onDisconnect().remove", 0, 1, arguments.length);
        Yf("Firebase.onDisconnect().remove", this.qa);
        A("Firebase.onDisconnect().remove", 1, a, !0);
        Sh(this.ad, this.qa, null, a);
      };
      X.prototype.remove = X.prototype.remove;
      X.prototype.set = function(a, b) {
        x("Firebase.onDisconnect().set", 1, 2, arguments.length);
        Yf("Firebase.onDisconnect().set", this.qa);
        Rf("Firebase.onDisconnect().set", a, this.qa, !1);
        A("Firebase.onDisconnect().set", 2, b, !0);
        Sh(this.ad, this.qa, a, b);
      };
      X.prototype.set = X.prototype.set;
      X.prototype.Kb = function(a, b, c) {
        x("Firebase.onDisconnect().setWithPriority", 2, 3, arguments.length);
        Yf("Firebase.onDisconnect().setWithPriority", this.qa);
        Rf("Firebase.onDisconnect().setWithPriority", a, this.qa, !1);
        Uf("Firebase.onDisconnect().setWithPriority", 2, b);
        A("Firebase.onDisconnect().setWithPriority", 3, c, !0);
        Th(this.ad, this.qa, a, b, c);
      };
      X.prototype.setWithPriority = X.prototype.Kb;
      X.prototype.update = function(a, b) {
        x("Firebase.onDisconnect().update", 1, 2, arguments.length);
        Yf("Firebase.onDisconnect().update", this.qa);
        if (ea(a)) {
          for (var c = {},
              d = 0; d < a.length; ++d)
            c["" + d] = a[d];
          a = c;
          Q("Passing an Array to Firebase.onDisconnect().update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.");
        }
        Tf("Firebase.onDisconnect().update", a, this.qa);
        A("Firebase.onDisconnect().update", 2, b, !0);
        Uh(this.ad, this.qa, a, b);
      };
      X.prototype.update = X.prototype.update;
      function Y(a, b, c, d) {
        this.k = a;
        this.path = b;
        this.n = c;
        this.jc = d;
      }
      function ei(a) {
        var b = null,
            c = null;
        a.la && (b = od(a));
        a.na && (c = qd(a));
        if (a.g === Vd) {
          if (a.la) {
            if ("[MIN_NAME]" != nd(a))
              throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");
            if ("string" !== typeof b)
              throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");
          }
          if (a.na) {
            if ("[MAX_NAME]" != pd(a))
              throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");
            if ("string" !== typeof c)
              throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");
          }
        } else if (a.g === M) {
          if (null != b && !Qf(b) || null != c && !Qf(c))
            throw Error("Query: When ordering by priority, the first argument passed to startAt(), endAt(), or equalTo() must be a valid priority value (null, a number, or a string).");
        } else if (J(a.g instanceof Rd || a.g === Yd, "unknown index type."), null != b && "object" === typeof b || null != c && "object" === typeof c)
          throw Error("Query: First argument passed to startAt(), endAt(), or equalTo() cannot be an object.");
      }
      function fi(a) {
        if (a.la && a.na && a.ia && (!a.ia || "" === a.Nb))
          throw Error("Query: Can't combine startAt(), endAt(), and limit(). Use limitToFirst() or limitToLast() instead.");
      }
      function gi(a, b) {
        if (!0 === a.jc)
          throw Error(b + ": You can't combine multiple orderBy calls.");
      }
      Y.prototype.lc = function() {
        x("Query.ref", 0, 0, arguments.length);
        return new U(this.k, this.path);
      };
      Y.prototype.ref = Y.prototype.lc;
      Y.prototype.Eb = function(a, b, c, d) {
        x("Query.on", 2, 4, arguments.length);
        Vf("Query.on", a, !1);
        A("Query.on", 2, b, !1);
        var e = hi("Query.on", c, d);
        if ("value" === a)
          Vh(this.k, this, new jd(b, e.cancel || null, e.Ma || null));
        else {
          var f = {};
          f[a] = b;
          Vh(this.k, this, new kd(f, e.cancel, e.Ma));
        }
        return b;
      };
      Y.prototype.on = Y.prototype.Eb;
      Y.prototype.gc = function(a, b, c) {
        x("Query.off", 0, 3, arguments.length);
        Vf("Query.off", a, !0);
        A("Query.off", 2, b, !0);
        lb("Query.off", 3, c);
        var d = null,
            e = null;
        "value" === a ? d = new jd(b || null, null, c || null) : a && (b && (e = {}, e[a] = b), d = new kd(e, null, c || null));
        e = this.k;
        d = ".info" === O(this.path) ? e.zd.kb(this, d) : e.O.kb(this, d);
        xb(e.ea, this.path, d);
      };
      Y.prototype.off = Y.prototype.gc;
      Y.prototype.Ag = function(a, b) {
        function c(g) {
          f && (f = !1, e.gc(a, c), b.call(d.Ma, g));
        }
        x("Query.once", 2, 4, arguments.length);
        Vf("Query.once", a, !1);
        A("Query.once", 2, b, !1);
        var d = hi("Query.once", arguments[2], arguments[3]),
            e = this,
            f = !0;
        this.Eb(a, c, function(b) {
          e.gc(a, c);
          d.cancel && d.cancel.call(d.Ma, b);
        });
      };
      Y.prototype.once = Y.prototype.Ag;
      Y.prototype.Ge = function(a) {
        Q("Query.limit() being deprecated. Please use Query.limitToFirst() or Query.limitToLast() instead.");
        x("Query.limit", 1, 1, arguments.length);
        if (!ga(a) || Math.floor(a) !== a || 0 >= a)
          throw Error("Query.limit: First argument must be a positive integer.");
        if (this.n.ia)
          throw Error("Query.limit: Limit was already set (by another call to limit, limitToFirst, orlimitToLast.");
        var b = this.n.Ge(a);
        fi(b);
        return new Y(this.k, this.path, b, this.jc);
      };
      Y.prototype.limit = Y.prototype.Ge;
      Y.prototype.He = function(a) {
        x("Query.limitToFirst", 1, 1, arguments.length);
        if (!ga(a) || Math.floor(a) !== a || 0 >= a)
          throw Error("Query.limitToFirst: First argument must be a positive integer.");
        if (this.n.ia)
          throw Error("Query.limitToFirst: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");
        return new Y(this.k, this.path, this.n.He(a), this.jc);
      };
      Y.prototype.limitToFirst = Y.prototype.He;
      Y.prototype.Ie = function(a) {
        x("Query.limitToLast", 1, 1, arguments.length);
        if (!ga(a) || Math.floor(a) !== a || 0 >= a)
          throw Error("Query.limitToLast: First argument must be a positive integer.");
        if (this.n.ia)
          throw Error("Query.limitToLast: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");
        return new Y(this.k, this.path, this.n.Ie(a), this.jc);
      };
      Y.prototype.limitToLast = Y.prototype.Ie;
      Y.prototype.Bg = function(a) {
        x("Query.orderByChild", 1, 1, arguments.length);
        if ("$key" === a)
          throw Error('Query.orderByChild: "$key" is invalid.  Use Query.orderByKey() instead.');
        if ("$priority" === a)
          throw Error('Query.orderByChild: "$priority" is invalid.  Use Query.orderByPriority() instead.');
        if ("$value" === a)
          throw Error('Query.orderByChild: "$value" is invalid.  Use Query.orderByValue() instead.');
        Wf("Query.orderByChild", 1, a, !1);
        gi(this, "Query.orderByChild");
        var b = be(this.n, new Rd(a));
        ei(b);
        return new Y(this.k, this.path, b, !0);
      };
      Y.prototype.orderByChild = Y.prototype.Bg;
      Y.prototype.Cg = function() {
        x("Query.orderByKey", 0, 0, arguments.length);
        gi(this, "Query.orderByKey");
        var a = be(this.n, Vd);
        ei(a);
        return new Y(this.k, this.path, a, !0);
      };
      Y.prototype.orderByKey = Y.prototype.Cg;
      Y.prototype.Dg = function() {
        x("Query.orderByPriority", 0, 0, arguments.length);
        gi(this, "Query.orderByPriority");
        var a = be(this.n, M);
        ei(a);
        return new Y(this.k, this.path, a, !0);
      };
      Y.prototype.orderByPriority = Y.prototype.Dg;
      Y.prototype.Eg = function() {
        x("Query.orderByValue", 0, 0, arguments.length);
        gi(this, "Query.orderByValue");
        var a = be(this.n, Yd);
        ei(a);
        return new Y(this.k, this.path, a, !0);
      };
      Y.prototype.orderByValue = Y.prototype.Eg;
      Y.prototype.Xd = function(a, b) {
        x("Query.startAt", 0, 2, arguments.length);
        Rf("Query.startAt", a, this.path, !0);
        Wf("Query.startAt", 2, b, !0);
        var c = this.n.Xd(a, b);
        fi(c);
        ei(c);
        if (this.n.la)
          throw Error("Query.startAt: Starting point was already set (by another call to startAt or equalTo).");
        n(a) || (b = a = null);
        return new Y(this.k, this.path, c, this.jc);
      };
      Y.prototype.startAt = Y.prototype.Xd;
      Y.prototype.qd = function(a, b) {
        x("Query.endAt", 0, 2, arguments.length);
        Rf("Query.endAt", a, this.path, !0);
        Wf("Query.endAt", 2, b, !0);
        var c = this.n.qd(a, b);
        fi(c);
        ei(c);
        if (this.n.na)
          throw Error("Query.endAt: Ending point was already set (by another call to endAt or equalTo).");
        return new Y(this.k, this.path, c, this.jc);
      };
      Y.prototype.endAt = Y.prototype.qd;
      Y.prototype.hg = function(a, b) {
        x("Query.equalTo", 1, 2, arguments.length);
        Rf("Query.equalTo", a, this.path, !1);
        Wf("Query.equalTo", 2, b, !0);
        if (this.n.la)
          throw Error("Query.equalTo: Starting point was already set (by another call to endAt or equalTo).");
        if (this.n.na)
          throw Error("Query.equalTo: Ending point was already set (by another call to endAt or equalTo).");
        return this.Xd(a, b).qd(a, b);
      };
      Y.prototype.equalTo = Y.prototype.hg;
      Y.prototype.toString = function() {
        x("Query.toString", 0, 0, arguments.length);
        for (var a = this.path,
            b = "",
            c = a.Y; c < a.o.length; c++)
          "" !== a.o[c] && (b += "/" + encodeURIComponent(String(a.o[c])));
        a = this.k.toString() + (b || "/");
        b = jb(ee(this.n));
        return a += b.replace(/^&/, "");
      };
      Y.prototype.toString = Y.prototype.toString;
      Y.prototype.wa = function() {
        var a = Wc(ce(this.n));
        return "{}" === a ? "default" : a;
      };
      function hi(a, b, c) {
        var d = {
          cancel: null,
          Ma: null
        };
        if (b && c)
          d.cancel = b, A(a, 3, d.cancel, !0), d.Ma = c, lb(a, 4, d.Ma);
        else if (b)
          if ("object" === typeof b && null !== b)
            d.Ma = b;
          else if ("function" === typeof b)
            d.cancel = b;
          else
            throw Error(z(a, 3, !0) + " must either be a cancel callback or a context object.");
        return d;
      }
      ;
      var Z = {};
      Z.vc = wh;
      Z.DataConnection = Z.vc;
      wh.prototype.Og = function(a, b) {
        this.Da("q", {p: a}, b);
      };
      Z.vc.prototype.simpleListen = Z.vc.prototype.Og;
      wh.prototype.gg = function(a, b) {
        this.Da("echo", {d: a}, b);
      };
      Z.vc.prototype.echo = Z.vc.prototype.gg;
      wh.prototype.interrupt = wh.prototype.yb;
      Z.Sf = kh;
      Z.RealTimeConnection = Z.Sf;
      kh.prototype.sendRequest = kh.prototype.Da;
      kh.prototype.close = kh.prototype.close;
      Z.og = function(a) {
        var b = wh.prototype.put;
        wh.prototype.put = function(c, d, e, f) {
          n(f) && (f = a());
          b.call(this, c, d, e, f);
        };
        return function() {
          wh.prototype.put = b;
        };
      };
      Z.hijackHash = Z.og;
      Z.Rf = Ec;
      Z.ConnectionTarget = Z.Rf;
      Z.wa = function(a) {
        return a.wa();
      };
      Z.queryIdentifier = Z.wa;
      Z.qg = function(a) {
        return a.k.Ra.aa;
      };
      Z.listens = Z.qg;
      Z.ue = function(a) {
        a.ue();
      };
      Z.forceRestClient = Z.ue;
      function U(a, b) {
        var c,
            d,
            e;
        if (a instanceof Kh)
          c = a, d = b;
        else {
          x("new Firebase", 1, 2, arguments.length);
          d = Rc(arguments[0]);
          c = d.Qg;
          "firebase" === d.domain && Qc(d.host + " is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead");
          c || Qc("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com");
          d.lb || "undefined" !== typeof window && window.location && window.location.protocol && -1 !== window.location.protocol.indexOf("https:") && Q("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().");
          c = new Ec(d.host, d.lb, c, "ws" === d.scheme || "wss" === d.scheme);
          d = new K(d.Zc);
          e = d.toString();
          var f;
          !(f = !p(c.host) || 0 === c.host.length || !Pf(c.Cb)) && (f = 0 !== e.length) && (e && (e = e.replace(/^\/*\.info(\/|$)/, "/")), f = !(p(e) && 0 !== e.length && !Of.test(e)));
          if (f)
            throw Error(z("new Firebase", 1, !1) + 'must be a valid firebase URL and the path can\'t contain ".", "#", "$", "[", or "]".');
          if (b)
            if (b instanceof W)
              e = b;
            else if (p(b))
              e = W.ub(), c.Ld = b;
            else
              throw Error("Expected a valid Firebase.Context for second argument to new Firebase()");
          else
            e = W.ub();
          f = c.toString();
          var g = w(e.nc, f);
          g || (g = new Kh(c, e.Pf), e.nc[f] = g);
          c = g;
        }
        Y.call(this, c, d, $d, !1);
      }
      ma(U, Y);
      var ii = U,
          ji = ["Firebase"],
          ki = aa;
      ji[0] in ki || !ki.execScript || ki.execScript("var " + ji[0]);
      for (var li; ji.length && (li = ji.shift()); )
        !ji.length && n(ii) ? ki[li] = ii : ki = ki[li] ? ki[li] : ki[li] = {};
      U.prototype.name = function() {
        Q("Firebase.name() being deprecated. Please use Firebase.key() instead.");
        x("Firebase.name", 0, 0, arguments.length);
        return this.key();
      };
      U.prototype.name = U.prototype.name;
      U.prototype.key = function() {
        x("Firebase.key", 0, 0, arguments.length);
        return this.path.e() ? null : vc(this.path);
      };
      U.prototype.key = U.prototype.key;
      U.prototype.w = function(a) {
        x("Firebase.child", 1, 1, arguments.length);
        if (ga(a))
          a = String(a);
        else if (!(a instanceof K))
          if (null === O(this.path)) {
            var b = a;
            b && (b = b.replace(/^\/*\.info(\/|$)/, "/"));
            Xf("Firebase.child", b);
          } else
            Xf("Firebase.child", a);
        return new U(this.k, this.path.w(a));
      };
      U.prototype.child = U.prototype.w;
      U.prototype.parent = function() {
        x("Firebase.parent", 0, 0, arguments.length);
        var a = this.path.parent();
        return null === a ? null : new U(this.k, a);
      };
      U.prototype.parent = U.prototype.parent;
      U.prototype.root = function() {
        x("Firebase.ref", 0, 0, arguments.length);
        for (var a = this; null !== a.parent(); )
          a = a.parent();
        return a;
      };
      U.prototype.root = U.prototype.root;
      U.prototype.set = function(a, b) {
        x("Firebase.set", 1, 2, arguments.length);
        Yf("Firebase.set", this.path);
        Rf("Firebase.set", a, this.path, !1);
        A("Firebase.set", 2, b, !0);
        this.k.Kb(this.path, a, null, b || null);
      };
      U.prototype.set = U.prototype.set;
      U.prototype.update = function(a, b) {
        x("Firebase.update", 1, 2, arguments.length);
        Yf("Firebase.update", this.path);
        if (ea(a)) {
          for (var c = {},
              d = 0; d < a.length; ++d)
            c["" + d] = a[d];
          a = c;
          Q("Passing an Array to Firebase.update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.");
        }
        Tf("Firebase.update", a, this.path);
        A("Firebase.update", 2, b, !0);
        this.k.update(this.path, a, b || null);
      };
      U.prototype.update = U.prototype.update;
      U.prototype.Kb = function(a, b, c) {
        x("Firebase.setWithPriority", 2, 3, arguments.length);
        Yf("Firebase.setWithPriority", this.path);
        Rf("Firebase.setWithPriority", a, this.path, !1);
        Uf("Firebase.setWithPriority", 2, b);
        A("Firebase.setWithPriority", 3, c, !0);
        if (".length" === this.key() || ".keys" === this.key())
          throw "Firebase.setWithPriority failed: " + this.key() + " is a read-only object.";
        this.k.Kb(this.path, a, b, c || null);
      };
      U.prototype.setWithPriority = U.prototype.Kb;
      U.prototype.remove = function(a) {
        x("Firebase.remove", 0, 1, arguments.length);
        Yf("Firebase.remove", this.path);
        A("Firebase.remove", 1, a, !0);
        this.set(null, a);
      };
      U.prototype.remove = U.prototype.remove;
      U.prototype.transaction = function(a, b, c) {
        x("Firebase.transaction", 1, 3, arguments.length);
        Yf("Firebase.transaction", this.path);
        A("Firebase.transaction", 1, a, !1);
        A("Firebase.transaction", 2, b, !0);
        if (n(c) && "boolean" != typeof c)
          throw Error(z("Firebase.transaction", 3, !0) + "must be a boolean.");
        if (".length" === this.key() || ".keys" === this.key())
          throw "Firebase.transaction failed: " + this.key() + " is a read-only object.";
        "undefined" === typeof c && (c = !0);
        Wh(this.k, this.path, a, b || null, c);
      };
      U.prototype.transaction = U.prototype.transaction;
      U.prototype.Lg = function(a, b) {
        x("Firebase.setPriority", 1, 2, arguments.length);
        Yf("Firebase.setPriority", this.path);
        Uf("Firebase.setPriority", 1, a);
        A("Firebase.setPriority", 2, b, !0);
        this.k.Kb(this.path.w(".priority"), a, null, b);
      };
      U.prototype.setPriority = U.prototype.Lg;
      U.prototype.push = function(a, b) {
        x("Firebase.push", 0, 2, arguments.length);
        Yf("Firebase.push", this.path);
        Rf("Firebase.push", a, this.path, !0);
        A("Firebase.push", 2, b, !0);
        var c = Mh(this.k),
            c = Kf(c),
            c = this.w(c);
        "undefined" !== typeof a && null !== a && c.set(a, b);
        return c;
      };
      U.prototype.push = U.prototype.push;
      U.prototype.jb = function() {
        Yf("Firebase.onDisconnect", this.path);
        return new X(this.k, this.path);
      };
      U.prototype.onDisconnect = U.prototype.jb;
      U.prototype.P = function(a, b, c) {
        Q("FirebaseRef.auth() being deprecated. Please use FirebaseRef.authWithCustomToken() instead.");
        x("Firebase.auth", 1, 3, arguments.length);
        Zf("Firebase.auth", a);
        A("Firebase.auth", 2, b, !0);
        A("Firebase.auth", 3, b, !0);
        Kg(this.k.P, a, {}, {remember: "none"}, b, c);
      };
      U.prototype.auth = U.prototype.P;
      U.prototype.ee = function(a) {
        x("Firebase.unauth", 0, 1, arguments.length);
        A("Firebase.unauth", 1, a, !0);
        Lg(this.k.P, a);
      };
      U.prototype.unauth = U.prototype.ee;
      U.prototype.we = function() {
        x("Firebase.getAuth", 0, 0, arguments.length);
        return this.k.P.we();
      };
      U.prototype.getAuth = U.prototype.we;
      U.prototype.ug = function(a, b) {
        x("Firebase.onAuth", 1, 2, arguments.length);
        A("Firebase.onAuth", 1, a, !1);
        lb("Firebase.onAuth", 2, b);
        this.k.P.Eb("auth_status", a, b);
      };
      U.prototype.onAuth = U.prototype.ug;
      U.prototype.tg = function(a, b) {
        x("Firebase.offAuth", 1, 2, arguments.length);
        A("Firebase.offAuth", 1, a, !1);
        lb("Firebase.offAuth", 2, b);
        this.k.P.gc("auth_status", a, b);
      };
      U.prototype.offAuth = U.prototype.tg;
      U.prototype.Wf = function(a, b, c) {
        x("Firebase.authWithCustomToken", 2, 3, arguments.length);
        Zf("Firebase.authWithCustomToken", a);
        A("Firebase.authWithCustomToken", 2, b, !1);
        ag("Firebase.authWithCustomToken", 3, c, !0);
        Kg(this.k.P, a, {}, c || {}, b);
      };
      U.prototype.authWithCustomToken = U.prototype.Wf;
      U.prototype.Xf = function(a, b, c) {
        x("Firebase.authWithOAuthPopup", 2, 3, arguments.length);
        $f("Firebase.authWithOAuthPopup", 1, a);
        A("Firebase.authWithOAuthPopup", 2, b, !1);
        ag("Firebase.authWithOAuthPopup", 3, c, !0);
        Pg(this.k.P, a, c, b);
      };
      U.prototype.authWithOAuthPopup = U.prototype.Xf;
      U.prototype.Yf = function(a, b, c) {
        x("Firebase.authWithOAuthRedirect", 2, 3, arguments.length);
        $f("Firebase.authWithOAuthRedirect", 1, a);
        A("Firebase.authWithOAuthRedirect", 2, b, !1);
        ag("Firebase.authWithOAuthRedirect", 3, c, !0);
        var d = this.k.P;
        Ng(d);
        var e = [wg],
            f = ig(c);
        "anonymous" === a || "firebase" === a ? R(b, yg("TRANSPORT_UNAVAILABLE")) : (P.set("redirect_client_options", f.ld), Og(d, e, "/auth/" + a, f, b));
      };
      U.prototype.authWithOAuthRedirect = U.prototype.Yf;
      U.prototype.Zf = function(a, b, c, d) {
        x("Firebase.authWithOAuthToken", 3, 4, arguments.length);
        $f("Firebase.authWithOAuthToken", 1, a);
        A("Firebase.authWithOAuthToken", 3, c, !1);
        ag("Firebase.authWithOAuthToken", 4, d, !0);
        p(b) ? ($f("Firebase.authWithOAuthToken", 2, b), Mg(this.k.P, a + "/token", {access_token: b}, d, c)) : (ag("Firebase.authWithOAuthToken", 2, b, !1), Mg(this.k.P, a + "/token", b, d, c));
      };
      U.prototype.authWithOAuthToken = U.prototype.Zf;
      U.prototype.Vf = function(a, b) {
        x("Firebase.authAnonymously", 1, 2, arguments.length);
        A("Firebase.authAnonymously", 1, a, !1);
        ag("Firebase.authAnonymously", 2, b, !0);
        Mg(this.k.P, "anonymous", {}, b, a);
      };
      U.prototype.authAnonymously = U.prototype.Vf;
      U.prototype.$f = function(a, b, c) {
        x("Firebase.authWithPassword", 2, 3, arguments.length);
        ag("Firebase.authWithPassword", 1, a, !1);
        bg("Firebase.authWithPassword", a, "email");
        bg("Firebase.authWithPassword", a, "password");
        A("Firebase.authAnonymously", 2, b, !1);
        ag("Firebase.authAnonymously", 3, c, !0);
        Mg(this.k.P, "password", a, c, b);
      };
      U.prototype.authWithPassword = U.prototype.$f;
      U.prototype.re = function(a, b) {
        x("Firebase.createUser", 2, 2, arguments.length);
        ag("Firebase.createUser", 1, a, !1);
        bg("Firebase.createUser", a, "email");
        bg("Firebase.createUser", a, "password");
        A("Firebase.createUser", 2, b, !1);
        this.k.P.re(a, b);
      };
      U.prototype.createUser = U.prototype.re;
      U.prototype.Se = function(a, b) {
        x("Firebase.removeUser", 2, 2, arguments.length);
        ag("Firebase.removeUser", 1, a, !1);
        bg("Firebase.removeUser", a, "email");
        bg("Firebase.removeUser", a, "password");
        A("Firebase.removeUser", 2, b, !1);
        this.k.P.Se(a, b);
      };
      U.prototype.removeUser = U.prototype.Se;
      U.prototype.oe = function(a, b) {
        x("Firebase.changePassword", 2, 2, arguments.length);
        ag("Firebase.changePassword", 1, a, !1);
        bg("Firebase.changePassword", a, "email");
        bg("Firebase.changePassword", a, "oldPassword");
        bg("Firebase.changePassword", a, "newPassword");
        A("Firebase.changePassword", 2, b, !1);
        this.k.P.oe(a, b);
      };
      U.prototype.changePassword = U.prototype.oe;
      U.prototype.ne = function(a, b) {
        x("Firebase.changeEmail", 2, 2, arguments.length);
        ag("Firebase.changeEmail", 1, a, !1);
        bg("Firebase.changeEmail", a, "oldEmail");
        bg("Firebase.changeEmail", a, "newEmail");
        bg("Firebase.changeEmail", a, "password");
        A("Firebase.changeEmail", 2, b, !1);
        this.k.P.ne(a, b);
      };
      U.prototype.changeEmail = U.prototype.ne;
      U.prototype.Ue = function(a, b) {
        x("Firebase.resetPassword", 2, 2, arguments.length);
        ag("Firebase.resetPassword", 1, a, !1);
        bg("Firebase.resetPassword", a, "email");
        A("Firebase.resetPassword", 2, b, !1);
        this.k.P.Ue(a, b);
      };
      U.prototype.resetPassword = U.prototype.Ue;
      U.goOffline = function() {
        x("Firebase.goOffline", 0, 0, arguments.length);
        W.ub().yb();
      };
      U.goOnline = function() {
        x("Firebase.goOnline", 0, 0, arguments.length);
        W.ub().qc();
      };
      function Nc(a, b) {
        J(!b || !0 === a || !1 === a, "Can't turn on custom loggers persistently.");
        !0 === a ? ("undefined" !== typeof console && ("function" === typeof console.log ? Ab = q(console.log, console) : "object" === typeof console.log && (Ab = function(a) {
          console.log(a);
        })), b && P.set("logging_enabled", !0)) : a ? Ab = a : (Ab = null, P.remove("logging_enabled"));
      }
      U.enableLogging = Nc;
      U.ServerValue = {TIMESTAMP: {".sv": "timestamp"}};
      U.SDK_VERSION = "2.2.4";
      U.INTERNAL = V;
      U.Context = W;
      U.TEST_ACCESS = Z;
    })();
  }).call(System.global);
  return System.get("@@global-helpers").retrieveGlobal(__module.id, false);
});



System.register("routers/ArvaRouter", ["npm:lodash@3.7.0", "core/Router", "utils/objectHelper", "github:angular/di.js@master", "npm:famous@0.3.5/core/View", "npm:famous@0.3.5/transitions/Easing", "github:ijzerenhein/famous-flex@0.3.1/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "routers/ArvaRouter";
  var _,
      Router,
      ObjectHelper,
      Provide,
      Inject,
      annotate,
      View,
      Easing,
      AnimationController,
      ArvaRouter;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }, function($__m) {
      Router = $__m.Router;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      Provide = $__m.Provide;
      Inject = $__m.Inject;
      annotate = $__m.annotate;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      Easing = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      ArvaRouter = $__export("ArvaRouter", (function($__super) {
        var ArvaRouter = function ArvaRouter() {
          $traceurRuntime.superConstructor(ArvaRouter).call(this);
          if (window == null) {
            return ;
          }
          this.routes = {};
          this.history = [];
          this.decode = decodeURIComponent;
          window.addEventListener('hashchange', this.run);
        };
        return ($traceurRuntime.createClass)(ArvaRouter, {
          setDefault: function(controller) {
            var method = arguments[1] !== (void 0) ? arguments[1] : null;
            this.defaultController = Object.getPrototypeOf(controller).constructor.name.replace('Controller', '');
            if (method != null)
              this.defaultMethod = method;
          },
          setControllerSpecs: function(specs) {
            this.specs = specs;
          },
          go: function(controller, method) {
            var params = arguments[2] !== (void 0) ? arguments[2] : null;
            var controllerName = '';
            if (Object.getPrototypeOf(controller).constructor.name == "Function")
              controllerName = controller.name;
            else
              controllerName = Object.getPrototypeOf(controller).constructor.name;
            var routeRoot = controllerName.replace(this.defaultController, '').replace('Controller', '');
            var hash = '#' + (routeRoot.length > 0 ? '/' + routeRoot : '') + ('/' + method);
            if (params) {
              for (var i = 0; i < Object.keys(params).length; i++) {
                var key = Object.keys(params)[i];
                hash += i == 0 ? '?' : '&';
                hash += (key + '=' + params[key]);
              }
            }
            if (history.pushState) {
              history.pushState(null, null, hash);
            }
            this.run();
          },
          add: function(route, handler) {
            var pieces = route.split('/'),
                rules = this.routes;
            for (var i = 0; i < pieces.length; ++i) {
              var piece = pieces[i],
                  name = piece[0] == ':' ? ':' : piece;
              rules = rules[name] || (rules[name] = {});
              if (name == ':') {
                rules['@name'] = piece.slice(1);
              }
            }
            rules['@'] = handler;
          },
          run: function() {
            var url = window.location.hash.replace('#', '');
            if (url !== '') {
              url = url.replace('/?', '?');
              url[0] == '/' && (url = url.slice(1));
              url.slice(-1) == '/' && (url = url.slice(0, -1));
            }
            var rules = this.routes,
                querySplit = url.split('?'),
                pieces = querySplit[0].split('/'),
                values = [],
                keys = [],
                method = '';
            var rule = null;
            var controller = null;
            if (pieces.length == 1 && pieces[0].length == 0) {
              pieces[0] = this.defaultController;
              pieces.push(this.defaultMethod);
            } else if (pieces.length == 1 && pieces[0].length > 0) {
              pieces.unshift(this.defaultController);
            }
            controller = pieces[0];
            for (var i = 0; i < pieces.length && rules; ++i) {
              var piece = this.decode(pieces[i]);
              rule = rules[piece];
              if (!rule && (rule = rules[':'])) {
                method = piece;
              }
              rules = rules[piece];
            }
            (function parseQuery(q) {
              var query = q.split('&');
              for (var i = 0; i < query.length; ++i) {
                var nameValue = query[i].split('=');
                if (nameValue.length > 1) {
                  keys.push(nameValue[0]);
                  values.push(this.decode(nameValue[1]));
                }
              }
            }).call(this, querySplit.length > 1 ? querySplit[1] : '');
            if (rule && rule['@']) {
              var previousRoute = this.history.length ? this.history[this.history.length - 1] : undefined;
              var currentRoute = {
                url: url,
                controller: controller,
                method: method,
                keys: keys,
                values: values
              };
              currentRoute.spec = previousRoute ? this._getAnimationSpec(previousRoute, currentRoute) : {};
              this._setHistory(currentRoute);
              rule['@'](currentRoute);
              return true;
            } else {
              console.log('Controller doesn\'t exist!');
            }
            return false;
          },
          _setHistory: function(currentRoute) {
            for (var i = 0; i < this.history.length; i++) {
              var previousRoute = this.history[i];
              if (currentRoute.controller === previousRoute.controller && currentRoute.method === previousRoute.method && _.isEqual(currentRoute.values, previousRoute.values)) {
                this.history.splice(i, this.history.length - i);
                break;
              }
            }
            this.history.push(currentRoute);
          },
          _hasVisited: function(currentRoute) {
            for (var i = 0; i < this.history.length; i++) {
              var previousRoute = this.history[i];
              if (currentRoute.controller === previousRoute.controller && currentRoute.method === previousRoute.method && _.isEqual(currentRoute.values, previousRoute.values)) {
                return true;
              }
            }
            return false;
          },
          _getAnimationSpec: function(previousRoute, currentRoute) {
            var fromController = previousRoute.controller;
            var toController = currentRoute.controller;
            if (fromController.indexOf('Controller') === -1) {
              fromController += 'Controller';
            }
            if (toController.indexOf('Controller') === -1) {
              toController += 'Controller';
            }
            if (currentRoute.controller === previousRoute.controller && currentRoute.method === previousRoute.method && _.isEqual(currentRoute.values, previousRoute.values)) {
              return {};
            }
            if (currentRoute.controller === previousRoute.controller) {
              var direction = this._hasVisited(currentRoute) ? 'previous' : 'next';
              if (this.specs && this.specs[fromController] && this.specs[fromController].methods) {
                return this.specs[fromController].methods[direction];
              }
              var defaults = {
                'previous': {
                  transition: {
                    duration: 1000,
                    curve: Easing.outBack
                  },
                  animation: AnimationController.Animation.Slide.Right
                },
                'next': {
                  transition: {
                    duration: 1000,
                    curve: Easing.outBack
                  },
                  animation: AnimationController.Animation.Slide.Left
                }
              };
              return defaults[direction];
            }
            if (this.specs && this.specs.hasOwnProperty(toController) && this.specs[toController].controllers) {
              var controllerSpecs = this.specs[toController].controllers;
              for (var specIndex in controllerSpecs) {
                var spec = controllerSpecs[specIndex];
                if (spec.activeFrom && spec.activeFrom.indexOf(fromController) !== -1) {
                  return spec;
                }
              }
            }
            throw new Error('No spec defined from ' + fromController + ' to ' + toController + '. Please check router.setControllerSpecs() in your app constructor.');
          }
        }, {}, $__super);
      }(Router)));
      annotate(ArvaRouter, new Provide(Router));
    }
  };
});



System.register("github:Bizboard/arva-context@master/Context", [], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/arva-context@master/Context";
  var contextContainer,
      Context;
  return {
    setters: [],
    execute: function() {
      contextContainer = {};
      Context = $__export("Context", {
        getContext: function() {
          var contextName = arguments[0] !== (void 0) ? arguments[0] : null;
          if (contextName)
            return contextContainer[contextName];
          else
            return contextContainer['Default'];
        },
        setContext: function(contextName, context) {
          contextContainer[contextName] = context;
        }
      });
    }
  };
});



System.register("github:angular/di.js@master/annotations", ["github:angular/di.js@master/util"], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master/annotations";
  var isFunction,
      SuperConstructor,
      TransientScope,
      Inject,
      InjectPromise,
      InjectLazy,
      Provide,
      ProvidePromise,
      ClassProvider,
      FactoryProvider;
  function annotate(fn, annotation) {
    fn.annotations = fn.annotations || [];
    fn.annotations.push(annotation);
  }
  function hasAnnotation(fn, annotationClass) {
    if (!fn.annotations || fn.annotations.length === 0) {
      return false;
    }
    for (var $__1 = fn.annotations[$traceurRuntime.toProperty(Symbol.iterator)](),
        $__2 = void 0; !($__2 = $__1.next()).done; ) {
      var annotation = $__2.value;
      {
        if (annotation instanceof annotationClass) {
          return true;
        }
      }
    }
    return false;
  }
  function readAnnotations(fn) {
    var collectedAnnotations = {
      provide: {
        token: null,
        isPromise: false
      },
      params: []
    };
    if (fn.annotations && fn.annotations.length) {
      for (var $__1 = fn.annotations[$traceurRuntime.toProperty(Symbol.iterator)](),
          $__2 = void 0; !($__2 = $__1.next()).done; ) {
        var annotation = $__2.value;
        {
          if (annotation instanceof Inject) {
            annotation.tokens.forEach((function(token) {
              collectedAnnotations.params.push({
                token: token,
                isPromise: annotation.isPromise,
                isLazy: annotation.isLazy
              });
            }));
          }
          if (annotation instanceof Provide) {
            collectedAnnotations.provide.token = annotation.token;
            collectedAnnotations.provide.isPromise = annotation.isPromise;
          }
        }
      }
    }
    if (fn.parameters) {
      fn.parameters.forEach((function(param, idx) {
        for (var $__3 = param[$traceurRuntime.toProperty(Symbol.iterator)](),
            $__4 = void 0; !($__4 = $__3.next()).done; ) {
          var paramAnnotation = $__4.value;
          {
            if (isFunction(paramAnnotation) && !collectedAnnotations.params[idx]) {
              collectedAnnotations.params[idx] = {
                token: paramAnnotation,
                isPromise: false,
                isLazy: false
              };
            } else if (paramAnnotation instanceof Inject) {
              collectedAnnotations.params[idx] = {
                token: paramAnnotation.tokens[0],
                isPromise: paramAnnotation.isPromise,
                isLazy: paramAnnotation.isLazy
              };
            }
          }
        }
      }));
    }
    return collectedAnnotations;
  }
  return {
    setters: [function($__m) {
      isFunction = $__m.isFunction;
    }],
    execute: function() {
      SuperConstructor = (function() {
        var SuperConstructor = function SuperConstructor() {};
        return ($traceurRuntime.createClass)(SuperConstructor, {}, {});
      }());
      TransientScope = (function() {
        var TransientScope = function TransientScope() {};
        return ($traceurRuntime.createClass)(TransientScope, {}, {});
      }());
      Inject = (function() {
        var Inject = function Inject() {
          for (var tokens = [],
              $__5 = 0; $__5 < arguments.length; $__5++)
            tokens[$__5] = arguments[$__5];
          this.tokens = tokens;
          this.isPromise = false;
          this.isLazy = false;
        };
        return ($traceurRuntime.createClass)(Inject, {}, {});
      }());
      InjectPromise = (function($__super) {
        var InjectPromise = function InjectPromise() {
          for (var tokens = [],
              $__5 = 0; $__5 < arguments.length; $__5++)
            tokens[$__5] = arguments[$__5];
          this.tokens = tokens;
          this.isPromise = true;
          this.isLazy = false;
        };
        return ($traceurRuntime.createClass)(InjectPromise, {}, {}, $__super);
      }(Inject));
      InjectLazy = (function($__super) {
        var InjectLazy = function InjectLazy() {
          for (var tokens = [],
              $__5 = 0; $__5 < arguments.length; $__5++)
            tokens[$__5] = arguments[$__5];
          this.tokens = tokens;
          this.isPromise = false;
          this.isLazy = true;
        };
        return ($traceurRuntime.createClass)(InjectLazy, {}, {}, $__super);
      }(Inject));
      Provide = (function() {
        var Provide = function Provide(token) {
          this.token = token;
          this.isPromise = false;
        };
        return ($traceurRuntime.createClass)(Provide, {}, {});
      }());
      ProvidePromise = (function($__super) {
        var ProvidePromise = function ProvidePromise(token) {
          this.token = token;
          this.isPromise = true;
        };
        return ($traceurRuntime.createClass)(ProvidePromise, {}, {}, $__super);
      }(Provide));
      ClassProvider = (function() {
        var ClassProvider = function ClassProvider() {};
        return ($traceurRuntime.createClass)(ClassProvider, {}, {});
      }());
      FactoryProvider = (function() {
        var FactoryProvider = function FactoryProvider() {};
        return ($traceurRuntime.createClass)(FactoryProvider, {}, {});
      }());
      $__export("annotate", annotate), $__export("hasAnnotation", hasAnnotation), $__export("readAnnotations", readAnnotations), $__export("SuperConstructor", SuperConstructor), $__export("TransientScope", TransientScope), $__export("Inject", Inject), $__export("InjectPromise", InjectPromise), $__export("InjectLazy", InjectLazy), $__export("Provide", Provide), $__export("ProvidePromise", ProvidePromise), $__export("ClassProvider", ClassProvider), $__export("FactoryProvider", FactoryProvider);
    }
  };
});



System.register("npm:process@0.10.1", ["npm:process@0.10.1/browser"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:process@0.10.1/browser");
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/SpecParser", ["npm:famous@0.3.5/core/Transform"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Transform = require("npm:famous@0.3.5/core/Transform");
  function SpecParser() {
    this.result = {};
  }
  SpecParser._instance = new SpecParser();
  SpecParser.parse = function parse(spec, context) {
    return SpecParser._instance.parse(spec, context);
  };
  SpecParser.prototype.parse = function parse(spec, context) {
    this.reset();
    this._parseSpec(spec, context, Transform.identity);
    return this.result;
  };
  SpecParser.prototype.reset = function reset() {
    this.result = {};
  };
  function _vecInContext(v, m) {
    return [v[0] * m[0] + v[1] * m[4] + v[2] * m[8], v[0] * m[1] + v[1] * m[5] + v[2] * m[9], v[0] * m[2] + v[1] * m[6] + v[2] * m[10]];
  }
  var _zeroZero = [0, 0];
  SpecParser.prototype._parseSpec = function _parseSpec(spec, parentContext, sizeContext) {
    var id;
    var target;
    var transform;
    var opacity;
    var origin;
    var align;
    var size;
    if (typeof spec === 'number') {
      id = spec;
      transform = parentContext.transform;
      align = parentContext.align || _zeroZero;
      if (parentContext.size && align && (align[0] || align[1])) {
        var alignAdjust = [align[0] * parentContext.size[0], align[1] * parentContext.size[1], 0];
        transform = Transform.thenMove(transform, _vecInContext(alignAdjust, sizeContext));
      }
      this.result[id] = {
        transform: transform,
        opacity: parentContext.opacity,
        origin: parentContext.origin || _zeroZero,
        align: parentContext.align || _zeroZero,
        size: parentContext.size
      };
    } else if (!spec) {
      return ;
    } else if (spec instanceof Array) {
      for (var i = 0; i < spec.length; i++) {
        this._parseSpec(spec[i], parentContext, sizeContext);
      }
    } else {
      target = spec.target;
      transform = parentContext.transform;
      opacity = parentContext.opacity;
      origin = parentContext.origin;
      align = parentContext.align;
      size = parentContext.size;
      var nextSizeContext = sizeContext;
      if (spec.opacity !== undefined)
        opacity = parentContext.opacity * spec.opacity;
      if (spec.transform)
        transform = Transform.multiply(parentContext.transform, spec.transform);
      if (spec.origin) {
        origin = spec.origin;
        nextSizeContext = parentContext.transform;
      }
      if (spec.align)
        align = spec.align;
      if (spec.size || spec.proportions) {
        var parentSize = size;
        size = [size[0], size[1]];
        if (spec.size) {
          if (spec.size[0] !== undefined)
            size[0] = spec.size[0];
          if (spec.size[1] !== undefined)
            size[1] = spec.size[1];
        }
        if (spec.proportions) {
          if (spec.proportions[0] !== undefined)
            size[0] = size[0] * spec.proportions[0];
          if (spec.proportions[1] !== undefined)
            size[1] = size[1] * spec.proportions[1];
        }
        if (parentSize) {
          if (align && (align[0] || align[1]))
            transform = Transform.thenMove(transform, _vecInContext([align[0] * parentSize[0], align[1] * parentSize[1], 0], sizeContext));
          if (origin && (origin[0] || origin[1]))
            transform = Transform.moveThen([-origin[0] * size[0], -origin[1] * size[1], 0], transform);
        }
        nextSizeContext = parentContext.transform;
        origin = null;
        align = null;
      }
      this._parseSpec(target, {
        transform: transform,
        opacity: opacity,
        origin: origin,
        align: align,
        size: size
      }, nextSizeContext);
    }
  };
  module.exports = SpecParser;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/EventHandler", ["npm:famous@0.3.5/core/EventEmitter"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var EventEmitter = require("npm:famous@0.3.5/core/EventEmitter");
  function EventHandler() {
    EventEmitter.apply(this, arguments);
    this.downstream = [];
    this.downstreamFn = [];
    this.upstream = [];
    this.upstreamListeners = {};
  }
  EventHandler.prototype = Object.create(EventEmitter.prototype);
  EventHandler.prototype.constructor = EventHandler;
  EventHandler.setInputHandler = function setInputHandler(object, handler) {
    object.trigger = handler.trigger.bind(handler);
    if (handler.subscribe && handler.unsubscribe) {
      object.subscribe = handler.subscribe.bind(handler);
      object.unsubscribe = handler.unsubscribe.bind(handler);
    }
  };
  EventHandler.setOutputHandler = function setOutputHandler(object, handler) {
    if (handler instanceof EventHandler)
      handler.bindThis(object);
    object.pipe = handler.pipe.bind(handler);
    object.unpipe = handler.unpipe.bind(handler);
    object.on = handler.on.bind(handler);
    object.addListener = object.on;
    object.removeListener = handler.removeListener.bind(handler);
  };
  EventHandler.prototype.emit = function emit(type, event) {
    EventEmitter.prototype.emit.apply(this, arguments);
    var i = 0;
    for (i = 0; i < this.downstream.length; i++) {
      if (this.downstream[i].trigger)
        this.downstream[i].trigger(type, event);
    }
    for (i = 0; i < this.downstreamFn.length; i++) {
      this.downstreamFn[i](type, event);
    }
    return this;
  };
  EventHandler.prototype.trigger = EventHandler.prototype.emit;
  EventHandler.prototype.pipe = function pipe(target) {
    if (target.subscribe instanceof Function)
      return target.subscribe(this);
    var downstreamCtx = target instanceof Function ? this.downstreamFn : this.downstream;
    var index = downstreamCtx.indexOf(target);
    if (index < 0)
      downstreamCtx.push(target);
    if (target instanceof Function)
      target('pipe', null);
    else if (target.trigger)
      target.trigger('pipe', null);
    return target;
  };
  EventHandler.prototype.unpipe = function unpipe(target) {
    if (target.unsubscribe instanceof Function)
      return target.unsubscribe(this);
    var downstreamCtx = target instanceof Function ? this.downstreamFn : this.downstream;
    var index = downstreamCtx.indexOf(target);
    if (index >= 0) {
      downstreamCtx.splice(index, 1);
      if (target instanceof Function)
        target('unpipe', null);
      else if (target.trigger)
        target.trigger('unpipe', null);
      return target;
    } else
      return false;
  };
  EventHandler.prototype.on = function on(type, handler) {
    EventEmitter.prototype.on.apply(this, arguments);
    if (!(type in this.upstreamListeners)) {
      var upstreamListener = this.trigger.bind(this, type);
      this.upstreamListeners[type] = upstreamListener;
      for (var i = 0; i < this.upstream.length; i++) {
        this.upstream[i].on(type, upstreamListener);
      }
    }
    return this;
  };
  EventHandler.prototype.addListener = EventHandler.prototype.on;
  EventHandler.prototype.subscribe = function subscribe(source) {
    var index = this.upstream.indexOf(source);
    if (index < 0) {
      this.upstream.push(source);
      for (var type in this.upstreamListeners) {
        source.on(type, this.upstreamListeners[type]);
      }
    }
    return this;
  };
  EventHandler.prototype.unsubscribe = function unsubscribe(source) {
    var index = this.upstream.indexOf(source);
    if (index >= 0) {
      this.upstream.splice(index, 1);
      for (var type in this.upstreamListeners) {
        source.removeListener(type, this.upstreamListeners[type]);
      }
    }
    return this;
  };
  module.exports = EventHandler;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/transitions/MultipleTransition", ["npm:famous@0.3.5/utilities/Utility"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Utility = require("npm:famous@0.3.5/utilities/Utility");
  function MultipleTransition(method) {
    this.method = method;
    this._instances = [];
    this.state = [];
  }
  MultipleTransition.SUPPORTS_MULTIPLE = true;
  MultipleTransition.prototype.get = function get() {
    for (var i = 0; i < this._instances.length; i++) {
      this.state[i] = this._instances[i].get();
    }
    return this.state;
  };
  MultipleTransition.prototype.set = function set(endState, transition, callback) {
    var _allCallback = Utility.after(endState.length, callback);
    for (var i = 0; i < endState.length; i++) {
      if (!this._instances[i])
        this._instances[i] = new this.method();
      this._instances[i].set(endState[i], transition, _allCallback);
    }
  };
  MultipleTransition.prototype.reset = function reset(startState) {
    for (var i = 0; i < startState.length; i++) {
      if (!this._instances[i])
        this._instances[i] = new this.method();
      this._instances[i].reset(startState[i]);
    }
  };
  module.exports = MultipleTransition;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Surface", ["npm:famous@0.3.5/core/ElementOutput"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var ElementOutput = require("npm:famous@0.3.5/core/ElementOutput");
  function Surface(options) {
    ElementOutput.call(this);
    this.options = {};
    this.properties = {};
    this.attributes = {};
    this.content = '';
    this.classList = [];
    this.size = null;
    this._classesDirty = true;
    this._stylesDirty = true;
    this._attributesDirty = true;
    this._sizeDirty = true;
    this._contentDirty = true;
    this._trueSizeCheck = true;
    this._dirtyClasses = [];
    if (options)
      this.setOptions(options);
    this._currentTarget = null;
  }
  Surface.prototype = Object.create(ElementOutput.prototype);
  Surface.prototype.constructor = Surface;
  Surface.prototype.elementType = 'div';
  Surface.prototype.elementClass = 'famous-surface';
  Surface.prototype.setAttributes = function setAttributes(attributes) {
    for (var n in attributes) {
      if (n === 'style')
        throw new Error('Cannot set styles via "setAttributes" as it will break Famo.us.  Use "setProperties" instead.');
      this.attributes[n] = attributes[n];
    }
    this._attributesDirty = true;
  };
  Surface.prototype.getAttributes = function getAttributes() {
    return this.attributes;
  };
  Surface.prototype.setProperties = function setProperties(properties) {
    for (var n in properties) {
      this.properties[n] = properties[n];
    }
    this._stylesDirty = true;
    return this;
  };
  Surface.prototype.getProperties = function getProperties() {
    return this.properties;
  };
  Surface.prototype.addClass = function addClass(className) {
    if (this.classList.indexOf(className) < 0) {
      this.classList.push(className);
      this._classesDirty = true;
    }
    return this;
  };
  Surface.prototype.removeClass = function removeClass(className) {
    var i = this.classList.indexOf(className);
    if (i >= 0) {
      this._dirtyClasses.push(this.classList.splice(i, 1)[0]);
      this._classesDirty = true;
    }
    return this;
  };
  Surface.prototype.toggleClass = function toggleClass(className) {
    var i = this.classList.indexOf(className);
    if (i >= 0) {
      this.removeClass(className);
    } else {
      this.addClass(className);
    }
    return this;
  };
  Surface.prototype.setClasses = function setClasses(classList) {
    var i = 0;
    var removal = [];
    for (i = 0; i < this.classList.length; i++) {
      if (classList.indexOf(this.classList[i]) < 0)
        removal.push(this.classList[i]);
    }
    for (i = 0; i < removal.length; i++)
      this.removeClass(removal[i]);
    for (i = 0; i < classList.length; i++)
      this.addClass(classList[i]);
    return this;
  };
  Surface.prototype.getClassList = function getClassList() {
    return this.classList;
  };
  Surface.prototype.setContent = function setContent(content) {
    if (this.content !== content) {
      this.content = content;
      this._contentDirty = true;
    }
    return this;
  };
  Surface.prototype.getContent = function getContent() {
    return this.content;
  };
  Surface.prototype.setOptions = function setOptions(options) {
    if (options.size)
      this.setSize(options.size);
    if (options.classes)
      this.setClasses(options.classes);
    if (options.properties)
      this.setProperties(options.properties);
    if (options.attributes)
      this.setAttributes(options.attributes);
    if (options.content)
      this.setContent(options.content);
    return this;
  };
  function _cleanupClasses(target) {
    for (var i = 0; i < this._dirtyClasses.length; i++)
      target.classList.remove(this._dirtyClasses[i]);
    this._dirtyClasses = [];
  }
  function _applyStyles(target) {
    for (var n in this.properties) {
      target.style[n] = this.properties[n];
    }
  }
  function _cleanupStyles(target) {
    for (var n in this.properties) {
      target.style[n] = '';
    }
  }
  function _applyAttributes(target) {
    for (var n in this.attributes) {
      target.setAttribute(n, this.attributes[n]);
    }
  }
  function _cleanupAttributes(target) {
    for (var n in this.attributes) {
      target.removeAttribute(n);
    }
  }
  function _xyNotEquals(a, b) {
    return a && b ? a[0] !== b[0] || a[1] !== b[1] : a !== b;
  }
  Surface.prototype.setup = function setup(allocator) {
    var target = allocator.allocate(this.elementType);
    if (this.elementClass) {
      if (this.elementClass instanceof Array) {
        for (var i = 0; i < this.elementClass.length; i++) {
          target.classList.add(this.elementClass[i]);
        }
      } else {
        target.classList.add(this.elementClass);
      }
    }
    target.style.display = '';
    this.attach(target);
    this._opacity = null;
    this._currentTarget = target;
    this._stylesDirty = true;
    this._classesDirty = true;
    this._attributesDirty = true;
    this._sizeDirty = true;
    this._contentDirty = true;
    this._originDirty = true;
    this._transformDirty = true;
  };
  Surface.prototype.commit = function commit(context) {
    if (!this._currentTarget)
      this.setup(context.allocator);
    var target = this._currentTarget;
    var size = context.size;
    if (this._classesDirty) {
      _cleanupClasses.call(this, target);
      var classList = this.getClassList();
      for (var i = 0; i < classList.length; i++)
        target.classList.add(classList[i]);
      this._classesDirty = false;
      this._trueSizeCheck = true;
    }
    if (this._stylesDirty) {
      _applyStyles.call(this, target);
      this._stylesDirty = false;
      this._trueSizeCheck = true;
    }
    if (this._attributesDirty) {
      _applyAttributes.call(this, target);
      this._attributesDirty = false;
      this._trueSizeCheck = true;
    }
    if (this.size) {
      var origSize = context.size;
      size = [this.size[0], this.size[1]];
      if (size[0] === undefined)
        size[0] = origSize[0];
      if (size[1] === undefined)
        size[1] = origSize[1];
      if (size[0] === true || size[1] === true) {
        if (size[0] === true) {
          if (this._trueSizeCheck || this._size[0] === 0) {
            var width = target.offsetWidth;
            if (this._size && this._size[0] !== width) {
              this._size[0] = width;
              this._sizeDirty = true;
            }
            size[0] = width;
          } else {
            if (this._size)
              size[0] = this._size[0];
          }
        }
        if (size[1] === true) {
          if (this._trueSizeCheck || this._size[1] === 0) {
            var height = target.offsetHeight;
            if (this._size && this._size[1] !== height) {
              this._size[1] = height;
              this._sizeDirty = true;
            }
            size[1] = height;
          } else {
            if (this._size)
              size[1] = this._size[1];
          }
        }
        this._trueSizeCheck = false;
      }
    }
    if (_xyNotEquals(this._size, size)) {
      if (!this._size)
        this._size = [0, 0];
      this._size[0] = size[0];
      this._size[1] = size[1];
      this._sizeDirty = true;
    }
    if (this._sizeDirty) {
      if (this._size) {
        target.style.width = this.size && this.size[0] === true ? '' : this._size[0] + 'px';
        target.style.height = this.size && this.size[1] === true ? '' : this._size[1] + 'px';
      }
      this._eventOutput.emit('resize');
    }
    if (this._contentDirty) {
      this.deploy(target);
      this._eventOutput.emit('deploy');
      this._contentDirty = false;
      this._trueSizeCheck = true;
    }
    ElementOutput.prototype.commit.call(this, context);
  };
  Surface.prototype.cleanup = function cleanup(allocator) {
    var i = 0;
    var target = this._currentTarget;
    this._eventOutput.emit('recall');
    this.recall(target);
    target.style.display = 'none';
    target.style.opacity = '';
    target.style.width = '';
    target.style.height = '';
    _cleanupStyles.call(this, target);
    _cleanupAttributes.call(this, target);
    var classList = this.getClassList();
    _cleanupClasses.call(this, target);
    for (i = 0; i < classList.length; i++)
      target.classList.remove(classList[i]);
    if (this.elementClass) {
      if (this.elementClass instanceof Array) {
        for (i = 0; i < this.elementClass.length; i++) {
          target.classList.remove(this.elementClass[i]);
        }
      } else {
        target.classList.remove(this.elementClass);
      }
    }
    this.detach(target);
    this._currentTarget = null;
    allocator.deallocate(target);
  };
  Surface.prototype.deploy = function deploy(target) {
    var content = this.getContent();
    if (content instanceof Node) {
      while (target.hasChildNodes())
        target.removeChild(target.firstChild);
      target.appendChild(content);
    } else
      target.innerHTML = content;
  };
  Surface.prototype.recall = function recall(target) {
    var df = document.createDocumentFragment();
    while (target.hasChildNodes())
      df.appendChild(target.firstChild);
    this.setContent(df);
  };
  Surface.prototype.getSize = function getSize() {
    return this._size ? this._size : this.size;
  };
  Surface.prototype.setSize = function setSize(size) {
    this.size = size ? [size[0], size[1]] : null;
    this._sizeDirty = true;
    return this;
  };
  module.exports = Surface;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Modifier", ["npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/transitions/Transitionable", "npm:famous@0.3.5/transitions/TransitionableTransform"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
  var TransitionableTransform = require("npm:famous@0.3.5/transitions/TransitionableTransform");
  function Modifier(options) {
    this._transformGetter = null;
    this._opacityGetter = null;
    this._originGetter = null;
    this._alignGetter = null;
    this._sizeGetter = null;
    this._proportionGetter = null;
    this._legacyStates = {};
    this._output = {
      transform: Transform.identity,
      opacity: 1,
      origin: null,
      align: null,
      size: null,
      proportions: null,
      target: null
    };
    if (options) {
      if (options.transform)
        this.transformFrom(options.transform);
      if (options.opacity !== undefined)
        this.opacityFrom(options.opacity);
      if (options.origin)
        this.originFrom(options.origin);
      if (options.align)
        this.alignFrom(options.align);
      if (options.size)
        this.sizeFrom(options.size);
      if (options.proportions)
        this.proportionsFrom(options.proportions);
    }
  }
  Modifier.prototype.transformFrom = function transformFrom(transform) {
    if (transform instanceof Function)
      this._transformGetter = transform;
    else if (transform instanceof Object && transform.get)
      this._transformGetter = transform.get.bind(transform);
    else {
      this._transformGetter = null;
      this._output.transform = transform;
    }
    return this;
  };
  Modifier.prototype.opacityFrom = function opacityFrom(opacity) {
    if (opacity instanceof Function)
      this._opacityGetter = opacity;
    else if (opacity instanceof Object && opacity.get)
      this._opacityGetter = opacity.get.bind(opacity);
    else {
      this._opacityGetter = null;
      this._output.opacity = opacity;
    }
    return this;
  };
  Modifier.prototype.originFrom = function originFrom(origin) {
    if (origin instanceof Function)
      this._originGetter = origin;
    else if (origin instanceof Object && origin.get)
      this._originGetter = origin.get.bind(origin);
    else {
      this._originGetter = null;
      this._output.origin = origin;
    }
    return this;
  };
  Modifier.prototype.alignFrom = function alignFrom(align) {
    if (align instanceof Function)
      this._alignGetter = align;
    else if (align instanceof Object && align.get)
      this._alignGetter = align.get.bind(align);
    else {
      this._alignGetter = null;
      this._output.align = align;
    }
    return this;
  };
  Modifier.prototype.sizeFrom = function sizeFrom(size) {
    if (size instanceof Function)
      this._sizeGetter = size;
    else if (size instanceof Object && size.get)
      this._sizeGetter = size.get.bind(size);
    else {
      this._sizeGetter = null;
      this._output.size = size;
    }
    return this;
  };
  Modifier.prototype.proportionsFrom = function proportionsFrom(proportions) {
    if (proportions instanceof Function)
      this._proportionGetter = proportions;
    else if (proportions instanceof Object && proportions.get)
      this._proportionGetter = proportions.get.bind(proportions);
    else {
      this._proportionGetter = null;
      this._output.proportions = proportions;
    }
    return this;
  };
  Modifier.prototype.setTransform = function setTransform(transform, transition, callback) {
    if (transition || this._legacyStates.transform) {
      if (!this._legacyStates.transform) {
        this._legacyStates.transform = new TransitionableTransform(this._output.transform);
      }
      if (!this._transformGetter)
        this.transformFrom(this._legacyStates.transform);
      this._legacyStates.transform.set(transform, transition, callback);
      return this;
    } else
      return this.transformFrom(transform);
  };
  Modifier.prototype.setOpacity = function setOpacity(opacity, transition, callback) {
    if (transition || this._legacyStates.opacity) {
      if (!this._legacyStates.opacity) {
        this._legacyStates.opacity = new Transitionable(this._output.opacity);
      }
      if (!this._opacityGetter)
        this.opacityFrom(this._legacyStates.opacity);
      return this._legacyStates.opacity.set(opacity, transition, callback);
    } else
      return this.opacityFrom(opacity);
  };
  Modifier.prototype.setOrigin = function setOrigin(origin, transition, callback) {
    if (transition || this._legacyStates.origin) {
      if (!this._legacyStates.origin) {
        this._legacyStates.origin = new Transitionable(this._output.origin || [0, 0]);
      }
      if (!this._originGetter)
        this.originFrom(this._legacyStates.origin);
      this._legacyStates.origin.set(origin, transition, callback);
      return this;
    } else
      return this.originFrom(origin);
  };
  Modifier.prototype.setAlign = function setAlign(align, transition, callback) {
    if (transition || this._legacyStates.align) {
      if (!this._legacyStates.align) {
        this._legacyStates.align = new Transitionable(this._output.align || [0, 0]);
      }
      if (!this._alignGetter)
        this.alignFrom(this._legacyStates.align);
      this._legacyStates.align.set(align, transition, callback);
      return this;
    } else
      return this.alignFrom(align);
  };
  Modifier.prototype.setSize = function setSize(size, transition, callback) {
    if (size && (transition || this._legacyStates.size)) {
      if (!this._legacyStates.size) {
        this._legacyStates.size = new Transitionable(this._output.size || [0, 0]);
      }
      if (!this._sizeGetter)
        this.sizeFrom(this._legacyStates.size);
      this._legacyStates.size.set(size, transition, callback);
      return this;
    } else
      return this.sizeFrom(size);
  };
  Modifier.prototype.setProportions = function setProportions(proportions, transition, callback) {
    if (proportions && (transition || this._legacyStates.proportions)) {
      if (!this._legacyStates.proportions) {
        this._legacyStates.proportions = new Transitionable(this._output.proportions || [0, 0]);
      }
      if (!this._proportionGetter)
        this.proportionsFrom(this._legacyStates.proportions);
      this._legacyStates.proportions.set(proportions, transition, callback);
      return this;
    } else
      return this.proportionsFrom(proportions);
  };
  Modifier.prototype.halt = function halt() {
    if (this._legacyStates.transform)
      this._legacyStates.transform.halt();
    if (this._legacyStates.opacity)
      this._legacyStates.opacity.halt();
    if (this._legacyStates.origin)
      this._legacyStates.origin.halt();
    if (this._legacyStates.align)
      this._legacyStates.align.halt();
    if (this._legacyStates.size)
      this._legacyStates.size.halt();
    if (this._legacyStates.proportions)
      this._legacyStates.proportions.halt();
    this._transformGetter = null;
    this._opacityGetter = null;
    this._originGetter = null;
    this._alignGetter = null;
    this._sizeGetter = null;
    this._proportionGetter = null;
  };
  Modifier.prototype.getTransform = function getTransform() {
    return this._transformGetter();
  };
  Modifier.prototype.getFinalTransform = function getFinalTransform() {
    return this._legacyStates.transform ? this._legacyStates.transform.getFinal() : this._output.transform;
  };
  Modifier.prototype.getOpacity = function getOpacity() {
    return this._opacityGetter();
  };
  Modifier.prototype.getOrigin = function getOrigin() {
    return this._originGetter();
  };
  Modifier.prototype.getAlign = function getAlign() {
    return this._alignGetter();
  };
  Modifier.prototype.getSize = function getSize() {
    return this._sizeGetter ? this._sizeGetter() : this._output.size;
  };
  Modifier.prototype.getProportions = function getProportions() {
    return this._proportionGetter ? this._proportionGetter() : this._output.proportions;
  };
  function _update() {
    if (this._transformGetter)
      this._output.transform = this._transformGetter();
    if (this._opacityGetter)
      this._output.opacity = this._opacityGetter();
    if (this._originGetter)
      this._output.origin = this._originGetter();
    if (this._alignGetter)
      this._output.align = this._alignGetter();
    if (this._sizeGetter)
      this._output.size = this._sizeGetter();
    if (this._proportionGetter)
      this._output.proportions = this._proportionGetter();
  }
  Modifier.prototype.modify = function modify(target) {
    _update.call(this);
    this._output.target = target;
    return this._output;
  };
  module.exports = Modifier;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNodeManager", ["github:ijzerenhein/famous-flex@0.3.1/src/LayoutContext", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutContext = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutContext");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    var MAX_POOL_SIZE = 100;
    function LayoutNodeManager(LayoutNode, initLayoutNodeFn) {
      this.LayoutNode = LayoutNode;
      this._initLayoutNodeFn = initLayoutNodeFn;
      this._layoutCount = 0;
      this._context = new LayoutContext({
        next: _contextNext.bind(this),
        prev: _contextPrev.bind(this),
        get: _contextGet.bind(this),
        set: _contextSet.bind(this),
        resolveSize: _contextResolveSize.bind(this),
        size: [0, 0]
      });
      this._contextState = {};
      this._pool = {
        layoutNodes: {size: 0},
        resolveSize: [0, 0]
      };
    }
    LayoutNodeManager.prototype.prepareForLayout = function(viewSequence, nodesById, contextData) {
      var node = this._first;
      while (node) {
        node.reset();
        node = node._next;
      }
      var context = this._context;
      this._layoutCount++;
      this._nodesById = nodesById;
      this._trueSizeRequested = false;
      this._reevalTrueSize = contextData.reevalTrueSize || !context.size || (context.size[0] !== contextData.size[0]) || (context.size[1] !== contextData.size[1]);
      var contextState = this._contextState;
      contextState.startSequence = viewSequence;
      contextState.nextSequence = viewSequence;
      contextState.prevSequence = viewSequence;
      contextState.start = undefined;
      contextState.nextGetIndex = 0;
      contextState.prevGetIndex = 0;
      contextState.nextSetIndex = 0;
      contextState.prevSetIndex = 0;
      contextState.addCount = 0;
      contextState.removeCount = 0;
      contextState.lastRenderNode = undefined;
      context.size[0] = contextData.size[0];
      context.size[1] = contextData.size[1];
      context.direction = contextData.direction;
      context.reverse = contextData.reverse;
      context.alignment = contextData.reverse ? 1 : 0;
      context.scrollOffset = contextData.scrollOffset || 0;
      context.scrollStart = contextData.scrollStart || 0;
      context.scrollEnd = contextData.scrollEnd || context.size[context.direction];
      return context;
    };
    LayoutNodeManager.prototype.removeNonInvalidatedNodes = function(removeSpec) {
      var node = this._first;
      while (node) {
        if (!node._invalidated && !node._removing) {
          node.remove(removeSpec);
        }
        node = node._next;
      }
    };
    LayoutNodeManager.prototype.removeVirtualViewSequenceNodes = function() {
      if (this._contextState.startSequence && this._contextState.startSequence.cleanup) {
        this._contextState.startSequence.cleanup();
      }
    };
    LayoutNodeManager.prototype.buildSpecAndDestroyUnrenderedNodes = function(translate) {
      var specs = [];
      var result = {
        specs: specs,
        modified: false
      };
      var node = this._first;
      while (node) {
        var modified = node._specModified;
        var spec = node.getSpec();
        if (spec.removed) {
          var destroyNode = node;
          node = node._next;
          _destroyNode.call(this, destroyNode);
          result.modified = true;
        } else {
          if (modified) {
            if (spec.transform && translate) {
              spec.transform[12] += translate[0];
              spec.transform[13] += translate[1];
              spec.transform[14] += translate[2];
              spec.transform[12] = Math.round(spec.transform[12] * 100000) / 100000;
              spec.transform[13] = Math.round(spec.transform[13] * 100000) / 100000;
              if (spec.endState) {
                spec.endState.transform[12] += translate[0];
                spec.endState.transform[13] += translate[1];
                spec.endState.transform[14] += translate[2];
                spec.endState.transform[12] = Math.round(spec.endState.transform[12] * 100000) / 100000;
                spec.endState.transform[13] = Math.round(spec.endState.transform[13] * 100000) / 100000;
              }
            }
            result.modified = true;
          }
          specs.push(spec);
          node = node._next;
        }
      }
      this._contextState.addCount = 0;
      this._contextState.removeCount = 0;
      return result;
    };
    LayoutNodeManager.prototype.getNodeByRenderNode = function(renderable) {
      var node = this._first;
      while (node) {
        if (node.renderNode === renderable) {
          return node;
        }
        node = node._next;
      }
      return undefined;
    };
    LayoutNodeManager.prototype.insertNode = function(node) {
      node._next = this._first;
      if (this._first) {
        this._first._prev = node;
      }
      this._first = node;
    };
    LayoutNodeManager.prototype.setNodeOptions = function(options) {
      this._nodeOptions = options;
      var node = this._first;
      while (node) {
        node.setOptions(options);
        node = node._next;
      }
      node = this._pool.layoutNodes.first;
      while (node) {
        node.setOptions(options);
        node = node._next;
      }
    };
    LayoutNodeManager.prototype.preallocateNodes = function(count, spec) {
      var nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push(this.createNode(undefined, spec));
      }
      for (i = 0; i < count; i++) {
        _destroyNode.call(this, nodes[i]);
      }
    };
    LayoutNodeManager.prototype.createNode = function(renderNode, spec) {
      var node;
      if (this._pool.layoutNodes.first) {
        node = this._pool.layoutNodes.first;
        this._pool.layoutNodes.first = node._next;
        this._pool.layoutNodes.size--;
        node.constructor.apply(node, arguments);
      } else {
        node = new this.LayoutNode(renderNode, spec);
        if (this._nodeOptions) {
          node.setOptions(this._nodeOptions);
        }
      }
      node._prev = undefined;
      node._next = undefined;
      node._viewSequence = undefined;
      node._layoutCount = 0;
      if (this._initLayoutNodeFn) {
        this._initLayoutNodeFn.call(this, node, spec);
      }
      return node;
    };
    LayoutNodeManager.prototype.removeAll = function() {
      var node = this._first;
      while (node) {
        var next = node._next;
        _destroyNode.call(this, node);
        node = next;
      }
      this._first = undefined;
    };
    function _destroyNode(node) {
      if (node._next) {
        node._next._prev = node._prev;
      }
      if (node._prev) {
        node._prev._next = node._next;
      } else {
        this._first = node._next;
      }
      node.destroy();
      if (this._pool.layoutNodes.size < MAX_POOL_SIZE) {
        this._pool.layoutNodes.size++;
        node._prev = undefined;
        node._next = this._pool.layoutNodes.first;
        this._pool.layoutNodes.first = node;
      }
    }
    LayoutNodeManager.prototype.getStartEnumNode = function(next) {
      if (next === undefined) {
        return this._first;
      } else if (next === true) {
        return (this._contextState.start && this._contextState.startPrev) ? this._contextState.start._next : this._contextState.start;
      } else if (next === false) {
        return (this._contextState.start && !this._contextState.startPrev) ? this._contextState.start._prev : this._contextState.start;
      }
    };
    function _contextGetCreateAndOrderNodes(renderNode, prev) {
      var node;
      var state = this._contextState;
      if (!state.start) {
        node = this._first;
        while (node) {
          if (node.renderNode === renderNode) {
            break;
          }
          node = node._next;
        }
        if (!node) {
          node = this.createNode(renderNode);
          node._next = this._first;
          if (this._first) {
            this._first._prev = node;
          }
          this._first = node;
        }
        state.start = node;
        state.startPrev = prev;
        state.prev = node;
        state.next = node;
        return node;
      }
      if (prev) {
        if (state.prev._prev && (state.prev._prev.renderNode === renderNode)) {
          state.prev = state.prev._prev;
          return state.prev;
        }
      } else {
        if (state.next._next && (state.next._next.renderNode === renderNode)) {
          state.next = state.next._next;
          return state.next;
        }
      }
      node = this._first;
      while (node) {
        if (node.renderNode === renderNode) {
          break;
        }
        node = node._next;
      }
      if (!node) {
        node = this.createNode(renderNode);
      } else {
        if (node._next) {
          node._next._prev = node._prev;
        }
        if (node._prev) {
          node._prev._next = node._next;
        } else {
          this._first = node._next;
        }
        node._next = undefined;
        node._prev = undefined;
      }
      if (prev) {
        if (state.prev._prev) {
          node._prev = state.prev._prev;
          state.prev._prev._next = node;
        } else {
          this._first = node;
        }
        state.prev._prev = node;
        node._next = state.prev;
        state.prev = node;
      } else {
        if (state.next._next) {
          node._next = state.next._next;
          state.next._next._prev = node;
        }
        state.next._next = node;
        node._prev = state.next;
        state.next = node;
      }
      return node;
    }
    function _contextNext() {
      if (!this._contextState.nextSequence) {
        return undefined;
      }
      if (this._context.reverse) {
        this._contextState.nextSequence = this._contextState.nextSequence.getNext();
        if (!this._contextState.nextSequence) {
          return undefined;
        }
      }
      var renderNode = this._contextState.nextSequence.get();
      if (!renderNode) {
        this._contextState.nextSequence = undefined;
        return undefined;
      }
      var nextSequence = this._contextState.nextSequence;
      if (!this._context.reverse) {
        this._contextState.nextSequence = this._contextState.nextSequence.getNext();
      }
      if (this._contextState.lastRenderNode === renderNode) {
        throw 'ViewSequence is corrupted, should never contain the same renderNode twice, index: ' + nextSequence.getIndex();
      }
      this._contextState.lastRenderNode = renderNode;
      return {
        renderNode: renderNode,
        viewSequence: nextSequence,
        next: true,
        index: ++this._contextState.nextGetIndex
      };
    }
    function _contextPrev() {
      if (!this._contextState.prevSequence) {
        return undefined;
      }
      if (!this._context.reverse) {
        this._contextState.prevSequence = this._contextState.prevSequence.getPrevious();
        if (!this._contextState.prevSequence) {
          return undefined;
        }
      }
      var renderNode = this._contextState.prevSequence.get();
      if (!renderNode) {
        this._contextState.prevSequence = undefined;
        return undefined;
      }
      var prevSequence = this._contextState.prevSequence;
      if (this._context.reverse) {
        this._contextState.prevSequence = this._contextState.prevSequence.getPrevious();
      }
      if (this._contextState.lastRenderNode === renderNode) {
        throw 'ViewSequence is corrupted, should never contain the same renderNode twice, index: ' + prevSequence.getIndex();
      }
      this._contextState.lastRenderNode = renderNode;
      return {
        renderNode: renderNode,
        viewSequence: prevSequence,
        prev: true,
        index: --this._contextState.prevGetIndex
      };
    }
    function _contextGet(contextNodeOrId) {
      if (this._nodesById && ((contextNodeOrId instanceof String) || (typeof contextNodeOrId === 'string'))) {
        var renderNode = this._nodesById[contextNodeOrId];
        if (!renderNode) {
          return undefined;
        }
        if (renderNode instanceof Array) {
          var result = [];
          for (var i = 0,
              j = renderNode.length; i < j; i++) {
            result.push({
              renderNode: renderNode[i],
              arrayElement: true
            });
          }
          return result;
        }
        return {
          renderNode: renderNode,
          byId: true
        };
      } else {
        return contextNodeOrId;
      }
    }
    function _contextSet(contextNodeOrId, set) {
      var contextNode = this._nodesById ? _contextGet.call(this, contextNodeOrId) : contextNodeOrId;
      if (contextNode) {
        var node = contextNode.node;
        if (!node) {
          if (contextNode.next) {
            if (contextNode.index < this._contextState.nextSetIndex) {
              LayoutUtility.error('Nodes must be layed out in the same order as they were requested!');
            }
            this._contextState.nextSetIndex = contextNode.index;
          } else if (contextNode.prev) {
            if (contextNode.index > this._contextState.prevSetIndex) {
              LayoutUtility.error('Nodes must be layed out in the same order as they were requested!');
            }
            this._contextState.prevSetIndex = contextNode.index;
          }
          node = _contextGetCreateAndOrderNodes.call(this, contextNode.renderNode, contextNode.prev);
          node._viewSequence = contextNode.viewSequence;
          node._layoutCount++;
          if (node._layoutCount === 1) {
            this._contextState.addCount++;
          }
          contextNode.node = node;
        }
        node.usesTrueSize = contextNode.usesTrueSize;
        node.trueSizeRequested = contextNode.trueSizeRequested;
        node.set(set, this._context.size);
        contextNode.set = set;
      }
      return set;
    }
    function _contextResolveSize(contextNodeOrId, parentSize) {
      var contextNode = this._nodesById ? _contextGet.call(this, contextNodeOrId) : contextNodeOrId;
      var resolveSize = this._pool.resolveSize;
      if (!contextNode) {
        resolveSize[0] = 0;
        resolveSize[1] = 0;
        return resolveSize;
      }
      var renderNode = contextNode.renderNode;
      var size = renderNode.getSize();
      if (!size) {
        return parentSize;
      }
      var configSize = renderNode.size && (renderNode._trueSizeCheck !== undefined) ? renderNode.size : undefined;
      if (configSize && ((configSize[0] === true) || (configSize[1] === true))) {
        contextNode.usesTrueSize = true;
        var backupSize = renderNode._backupSize;
        if (renderNode._contentDirty || renderNode._trueSizeCheck) {
          this._trueSizeRequested = true;
          contextNode.trueSizeRequested = true;
        }
        if (renderNode._trueSizeCheck) {
          if (backupSize && (configSize !== size)) {
            var newWidth = (configSize[0] === true) ? Math.max(backupSize[0], size[0]) : size[0];
            var newHeight = (configSize[1] === true) ? Math.max(backupSize[1], size[1]) : size[1];
            backupSize[0] = newWidth;
            backupSize[1] = newHeight;
            size = backupSize;
            renderNode._backupSize = undefined;
            backupSize = undefined;
          }
        }
        if (this._reevalTrueSize || (backupSize && ((backupSize[0] !== size[0]) || (backupSize[1] !== size[1])))) {
          renderNode._trueSizeCheck = true;
          renderNode._sizeDirty = true;
          this._trueSizeRequested = true;
        }
        if (!backupSize) {
          renderNode._backupSize = [0, 0];
          backupSize = renderNode._backupSize;
        }
        backupSize[0] = size[0];
        backupSize[1] = size[1];
      }
      configSize = renderNode._nodes ? renderNode.options.size : undefined;
      if (configSize && ((configSize[0] === true) || (configSize[1] === true))) {
        if (this._reevalTrueSize || renderNode._nodes._trueSizeRequested) {
          contextNode.usesTrueSize = true;
          contextNode.trueSizeRequested = true;
          this._trueSizeRequested = true;
        }
      }
      if ((size[0] === undefined) || (size[0] === true) || (size[1] === undefined) || (size[1] === true)) {
        resolveSize[0] = size[0];
        resolveSize[1] = size[1];
        size = resolveSize;
        if (size[0] === undefined) {
          size[0] = parentSize[0];
        } else if (size[0] === true) {
          size[0] = 0;
          this._trueSizeRequested = true;
          contextNode.trueSizeRequested = true;
        }
        if (size[1] === undefined) {
          size[1] = parentSize[1];
        } else if (size[1] === true) {
          size[1] = 0;
          this._trueSizeRequested = true;
          contextNode.trueSizeRequested = true;
        }
      }
      return size;
    }
    module.exports = LayoutNodeManager;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("npm:famous@0.3.5/physics/bodies/Particle", ["npm:famous@0.3.5/math/Vector", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/physics/integrators/SymplecticEuler"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Vector = require("npm:famous@0.3.5/math/Vector");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  var Integrator = require("npm:famous@0.3.5/physics/integrators/SymplecticEuler");
  function Particle(options) {
    options = options || {};
    var defaults = Particle.DEFAULT_OPTIONS;
    this.position = new Vector();
    this.velocity = new Vector();
    this.force = new Vector();
    this._engine = null;
    this._isSleeping = true;
    this._eventOutput = null;
    this.mass = options.mass !== undefined ? options.mass : defaults.mass;
    this.inverseMass = 1 / this.mass;
    this.setPosition(options.position || defaults.position);
    this.setVelocity(options.velocity || defaults.velocity);
    this.force.set(options.force || [0, 0, 0]);
    this.transform = Transform.identity.slice();
    this._spec = {
      size: [true, true],
      target: {
        transform: this.transform,
        origin: [0.5, 0.5],
        target: null
      }
    };
  }
  Particle.DEFAULT_OPTIONS = {
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    mass: 1
  };
  var _events = {
    start: 'start',
    update: 'update',
    end: 'end'
  };
  var now = Date.now;
  Particle.prototype.isBody = false;
  Particle.prototype.isActive = function isActive() {
    return !this._isSleeping;
  };
  Particle.prototype.sleep = function sleep() {
    if (this._isSleeping)
      return ;
    this.emit(_events.end, this);
    this._isSleeping = true;
  };
  Particle.prototype.wake = function wake() {
    if (!this._isSleeping)
      return ;
    this.emit(_events.start, this);
    this._isSleeping = false;
    this._prevTime = now();
    if (this._engine)
      this._engine.wake();
  };
  Particle.prototype.setPosition = function setPosition(position) {
    this.position.set(position);
  };
  Particle.prototype.setPosition1D = function setPosition1D(x) {
    this.position.x = x;
  };
  Particle.prototype.getPosition = function getPosition() {
    this._engine.step();
    return this.position.get();
  };
  Particle.prototype.getPosition1D = function getPosition1D() {
    this._engine.step();
    return this.position.x;
  };
  Particle.prototype.setVelocity = function setVelocity(velocity) {
    this.velocity.set(velocity);
    if (!(velocity[0] === 0 && velocity[1] === 0 && velocity[2] === 0))
      this.wake();
  };
  Particle.prototype.setVelocity1D = function setVelocity1D(x) {
    this.velocity.x = x;
    if (x !== 0)
      this.wake();
  };
  Particle.prototype.getVelocity = function getVelocity() {
    return this.velocity.get();
  };
  Particle.prototype.setForce = function setForce(force) {
    this.force.set(force);
    this.wake();
  };
  Particle.prototype.getVelocity1D = function getVelocity1D() {
    return this.velocity.x;
  };
  Particle.prototype.setMass = function setMass(mass) {
    this.mass = mass;
    this.inverseMass = 1 / mass;
  };
  Particle.prototype.getMass = function getMass() {
    return this.mass;
  };
  Particle.prototype.reset = function reset(position, velocity) {
    this.setPosition(position || [0, 0, 0]);
    this.setVelocity(velocity || [0, 0, 0]);
  };
  Particle.prototype.applyForce = function applyForce(force) {
    if (force.isZero())
      return ;
    this.force.add(force).put(this.force);
    this.wake();
  };
  Particle.prototype.applyImpulse = function applyImpulse(impulse) {
    if (impulse.isZero())
      return ;
    var velocity = this.velocity;
    velocity.add(impulse.mult(this.inverseMass)).put(velocity);
  };
  Particle.prototype.integrateVelocity = function integrateVelocity(dt) {
    Integrator.integrateVelocity(this, dt);
  };
  Particle.prototype.integratePosition = function integratePosition(dt) {
    Integrator.integratePosition(this, dt);
  };
  Particle.prototype._integrate = function _integrate(dt) {
    this.integrateVelocity(dt);
    this.integratePosition(dt);
  };
  Particle.prototype.getEnergy = function getEnergy() {
    return 0.5 * this.mass * this.velocity.normSquared();
  };
  Particle.prototype.getTransform = function getTransform() {
    this._engine.step();
    var position = this.position;
    var transform = this.transform;
    transform[12] = position.x;
    transform[13] = position.y;
    transform[14] = position.z;
    return transform;
  };
  Particle.prototype.modify = function modify(target) {
    var _spec = this._spec.target;
    _spec.transform = this.getTransform();
    _spec.target = target;
    return this._spec;
  };
  function _createEventOutput() {
    this._eventOutput = new EventHandler();
    this._eventOutput.bindThis(this);
    EventHandler.setOutputHandler(this, this._eventOutput);
  }
  Particle.prototype.emit = function emit(type, data) {
    if (!this._eventOutput)
      return ;
    this._eventOutput.emit(type, data);
  };
  Particle.prototype.on = function on() {
    _createEventOutput.call(this);
    return this.on.apply(this, arguments);
  };
  Particle.prototype.removeListener = function removeListener() {
    _createEventOutput.call(this);
    return this.removeListener.apply(this, arguments);
  };
  Particle.prototype.pipe = function pipe() {
    _createEventOutput.call(this);
    return this.pipe.apply(this, arguments);
  };
  Particle.prototype.unpipe = function unpipe() {
    _createEventOutput.call(this);
    return this.unpipe.apply(this, arguments);
  };
  module.exports = Particle;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/physics/forces/Spring", ["npm:famous@0.3.5/physics/forces/Force", "npm:famous@0.3.5/math/Vector"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Force = require("npm:famous@0.3.5/physics/forces/Force");
  var Vector = require("npm:famous@0.3.5/math/Vector");
  function Spring(options) {
    Force.call(this);
    this.options = Object.create(this.constructor.DEFAULT_OPTIONS);
    if (options)
      this.setOptions(options);
    this.disp = new Vector(0, 0, 0);
    _init.call(this);
  }
  Spring.prototype = Object.create(Force.prototype);
  Spring.prototype.constructor = Spring;
  var pi = Math.PI;
  var MIN_PERIOD = 150;
  Spring.FORCE_FUNCTIONS = {
    FENE: function(dist, rMax) {
      var rMaxSmall = rMax * 0.99;
      var r = Math.max(Math.min(dist, rMaxSmall), -rMaxSmall);
      return r / (1 - r * r / (rMax * rMax));
    },
    HOOK: function(dist) {
      return dist;
    }
  };
  Spring.DEFAULT_OPTIONS = {
    period: 300,
    dampingRatio: 0.1,
    length: 0,
    maxLength: Infinity,
    anchor: undefined,
    forceFunction: Spring.FORCE_FUNCTIONS.HOOK
  };
  function _calcStiffness() {
    var options = this.options;
    options.stiffness = Math.pow(2 * pi / options.period, 2);
  }
  function _calcDamping() {
    var options = this.options;
    options.damping = 4 * pi * options.dampingRatio / options.period;
  }
  function _init() {
    _calcStiffness.call(this);
    _calcDamping.call(this);
  }
  Spring.prototype.setOptions = function setOptions(options) {
    if (options.anchor !== undefined) {
      if (options.anchor.position instanceof Vector)
        this.options.anchor = options.anchor.position;
      if (options.anchor instanceof Vector)
        this.options.anchor = options.anchor;
      if (options.anchor instanceof Array)
        this.options.anchor = new Vector(options.anchor);
    }
    if (options.period !== undefined) {
      if (options.period < MIN_PERIOD) {
        options.period = MIN_PERIOD;
        console.warn('The period of a SpringTransition is capped at ' + MIN_PERIOD + ' ms. Use a SnapTransition for faster transitions');
      }
      this.options.period = options.period;
    }
    if (options.dampingRatio !== undefined)
      this.options.dampingRatio = options.dampingRatio;
    if (options.length !== undefined)
      this.options.length = options.length;
    if (options.forceFunction !== undefined)
      this.options.forceFunction = options.forceFunction;
    if (options.maxLength !== undefined)
      this.options.maxLength = options.maxLength;
    _init.call(this);
    Force.prototype.setOptions.call(this, options);
  };
  Spring.prototype.applyForce = function applyForce(targets, source) {
    var force = this.force;
    var disp = this.disp;
    var options = this.options;
    var stiffness = options.stiffness;
    var damping = options.damping;
    var restLength = options.length;
    var maxLength = options.maxLength;
    var anchor = options.anchor || source.position;
    var forceFunction = options.forceFunction;
    var i;
    var target;
    var p2;
    var v2;
    var dist;
    var m;
    for (i = 0; i < targets.length; i++) {
      target = targets[i];
      p2 = target.position;
      v2 = target.velocity;
      anchor.sub(p2).put(disp);
      dist = disp.norm() - restLength;
      if (dist === 0)
        return ;
      m = target.mass;
      stiffness *= m;
      damping *= m;
      disp.normalize(stiffness * forceFunction(dist, maxLength)).put(force);
      if (damping)
        if (source)
          force.add(v2.sub(source.velocity).mult(-damping)).put(force);
        else
          force.add(v2.mult(-damping)).put(force);
      target.applyForce(force);
      if (source)
        source.applyForce(force.mult(-1));
    }
  };
  Spring.prototype.getEnergy = function getEnergy(targets, source) {
    var options = this.options;
    var restLength = options.length;
    var anchor = source ? source.position : options.anchor;
    var strength = options.stiffness;
    var energy = 0;
    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      var dist = anchor.sub(target.position).norm() - restLength;
      energy += 0.5 * strength * dist * dist;
    }
    return energy;
  };
  module.exports = Spring;
  global.define = __define;
  return module.exports;
});



System.register("views/ProfileView", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/View", "utils/objectHelper", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface"], function($__export) {
  "use strict";
  var __moduleName = "views/ProfileView";
  var Engine,
      Surface,
      View,
      ObjectHelper,
      LayoutController,
      BkImageSurface,
      DEFAULT_OPTIONS,
      ProfileView;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      BkImageSurface = $__m.default;
    }],
    execute: function() {
      DEFAULT_OPTIONS = {
        classes: ['view', 'profile'],
        imageSize: [200, 200],
        imageScale: [1, 1, 1],
        nameHeight: 60,
        profileText: 'Scarlett Johansson was born in New York City. Her mother, Melanie Sloan, is from an Ashkenazi Jewish family, and her father, Karsten Johansson, is Danish. Scarlett showed a passion for acting at a young age and starred in many plays.<br><br>She has a sister named Vanessa Johansson, a brother named Adrian, and a twin brother named Hunter Johansson born three minutes after her. She began her acting career starring as Laura Nelson in the comedy film North (1994).<br><br>The acclaimed drama film The Horse Whisperer (1998) brought Johansson critical praise and worldwide recognition. Following the film\'s success, she starred in many other films including the critically acclaimed cult film Ghost World (2001) and then the hit Lost in Translation (2003) with Bill Murray in which she again stunned critics. Later on, she appeared in the drama film Girl with a Pearl Earring (2003).'
      };
      ProfileView = $__export("ProfileView", (function($__super) {
        var ProfileView = function ProfileView() {
          $traceurRuntime.superConstructor(ProfileView).call(this, DEFAULT_OPTIONS);
          ObjectHelper.bindAllMethods(this, this);
          ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
          ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');
          this._createRenderables();
          this._createLayout();
        };
        return ($traceurRuntime.createClass)(ProfileView, {
          _createRenderables: function() {
            this._renderables = {
              background: new Surface({classes: this.options.classes.concat(['background'])}),
              image: new BkImageSurface({
                classes: this.options.classes.concat(['image']),
                content: 'img/scarlett.jpg',
                sizeMode: 'cover'
              }),
              name: new Surface({
                classes: this.options.classes.concat(['name']),
                content: '<div>Scarlett Johansson</div>'
              }),
              text: new Surface({
                classes: this.options.classes.concat(['text']),
                content: this.options.profileText
              })
            };
          },
          _createLayout: function() {
            this.layout = new LayoutController({
              autoPipeEvents: true,
              layout: function(context, options) {
                context.set('background', {size: context.size});
                var image = context.set('image', {
                  size: this.options.imageSize,
                  translate: [(context.size[0] - this.options.imageSize[0]) / 2, 20, 1],
                  scale: this.options.imageScale
                });
                var name = context.set('name', {
                  size: [context.size[0], this.options.nameHeight],
                  translate: [0, image.size[1] + image.translate[1], 1]
                });
                context.set('text', {
                  size: [context.size[0], context.size[1] - name.size[1] - name.translate[1]],
                  translate: [0, name.translate[1] + name.size[1], 1]
                });
              }.bind(this),
              dataSource: this._renderables
            });
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
          }
        }, {}, $__super);
      }(View)));
    }
  };
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/ScrollController", ["github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode", "github:ijzerenhein/famous-flex@0.3.1/src/FlowLayoutNode", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutNodeManager", "npm:famous@0.3.5/surfaces/ContainerSurface", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/Group", "npm:famous@0.3.5/math/Vector", "npm:famous@0.3.5/physics/PhysicsEngine", "npm:famous@0.3.5/physics/bodies/Particle", "npm:famous@0.3.5/physics/forces/Drag", "npm:famous@0.3.5/physics/forces/Spring", "npm:famous@0.3.5/inputs/ScrollSync", "npm:famous@0.3.5/core/ViewSequence"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    var LayoutController = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutController");
    var LayoutNode = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode");
    var FlowLayoutNode = require("github:ijzerenhein/famous-flex@0.3.1/src/FlowLayoutNode");
    var LayoutNodeManager = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNodeManager");
    var ContainerSurface = require("npm:famous@0.3.5/surfaces/ContainerSurface");
    var Transform = require("npm:famous@0.3.5/core/Transform");
    var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
    var Group = require("npm:famous@0.3.5/core/Group");
    var Vector = require("npm:famous@0.3.5/math/Vector");
    var PhysicsEngine = require("npm:famous@0.3.5/physics/PhysicsEngine");
    var Particle = require("npm:famous@0.3.5/physics/bodies/Particle");
    var Drag = require("npm:famous@0.3.5/physics/forces/Drag");
    var Spring = require("npm:famous@0.3.5/physics/forces/Spring");
    var ScrollSync = require("npm:famous@0.3.5/inputs/ScrollSync");
    var ViewSequence = require("npm:famous@0.3.5/core/ViewSequence");
    var Bounds = {
      NONE: 0,
      PREV: 1,
      NEXT: 2,
      BOTH: 3
    };
    var SpringSource = {
      NONE: 'none',
      NEXTBOUNDS: 'next-bounds',
      PREVBOUNDS: 'prev-bounds',
      MINSIZE: 'minimal-size',
      GOTOSEQUENCE: 'goto-sequence',
      ENSUREVISIBLE: 'ensure-visible',
      GOTOPREVDIRECTION: 'goto-prev-direction',
      GOTONEXTDIRECTION: 'goto-next-direction'
    };
    var PaginationMode = {
      PAGE: 0,
      SCROLL: 1
    };
    function ScrollController(options) {
      options = LayoutUtility.combineOptions(ScrollController.DEFAULT_OPTIONS, options);
      var layoutManager = new LayoutNodeManager(options.flow ? FlowLayoutNode : LayoutNode, _initLayoutNode.bind(this));
      LayoutController.call(this, options, layoutManager);
      this._scroll = {
        activeTouches: [],
        pe: new PhysicsEngine(),
        particle: new Particle(this.options.scrollParticle),
        dragForce: new Drag(this.options.scrollDrag),
        frictionForce: new Drag(this.options.scrollFriction),
        springValue: undefined,
        springForce: new Spring(this.options.scrollSpring),
        springEndState: new Vector([0, 0, 0]),
        groupStart: 0,
        groupTranslate: [0, 0, 0],
        scrollDelta: 0,
        normalizedScrollDelta: 0,
        scrollForce: 0,
        scrollForceCount: 0,
        unnormalizedScrollOffset: 0,
        isScrolling: false
      };
      this._debug = {
        layoutCount: 0,
        commitCount: 0
      };
      this.group = new Group();
      this.group.add({render: _innerRender.bind(this)});
      this._scroll.pe.addBody(this._scroll.particle);
      if (!this.options.scrollDrag.disabled) {
        this._scroll.dragForceId = this._scroll.pe.attach(this._scroll.dragForce, this._scroll.particle);
      }
      if (!this.options.scrollFriction.disabled) {
        this._scroll.frictionForceId = this._scroll.pe.attach(this._scroll.frictionForce, this._scroll.particle);
      }
      this._scroll.springForce.setOptions({anchor: this._scroll.springEndState});
      this._eventInput.on('touchstart', _touchStart.bind(this));
      this._eventInput.on('touchmove', _touchMove.bind(this));
      this._eventInput.on('touchend', _touchEnd.bind(this));
      this._eventInput.on('touchcancel', _touchEnd.bind(this));
      this._eventInput.on('mousedown', _mouseDown.bind(this));
      this._eventInput.on('mouseup', _mouseUp.bind(this));
      this._eventInput.on('mousemove', _mouseMove.bind(this));
      this._scrollSync = new ScrollSync(this.options.scrollSync);
      this._eventInput.pipe(this._scrollSync);
      this._scrollSync.on('update', _scrollUpdate.bind(this));
      if (this.options.useContainer) {
        this.container = new ContainerSurface(this.options.container);
        this.container.add({render: function() {
            return this.id;
          }.bind(this)});
        if (!this.options.autoPipeEvents) {
          this.subscribe(this.container);
          EventHandler.setInputHandler(this.container, this);
          EventHandler.setOutputHandler(this.container, this);
        }
      }
    }
    ScrollController.prototype = Object.create(LayoutController.prototype);
    ScrollController.prototype.constructor = ScrollController;
    ScrollController.Bounds = Bounds;
    ScrollController.PaginationMode = PaginationMode;
    ScrollController.DEFAULT_OPTIONS = {
      useContainer: false,
      container: {properties: {overflow: 'hidden'}},
      scrollParticle: {},
      scrollDrag: {
        forceFunction: Drag.FORCE_FUNCTIONS.QUADRATIC,
        strength: 0.001,
        disabled: true
      },
      scrollFriction: {
        forceFunction: Drag.FORCE_FUNCTIONS.LINEAR,
        strength: 0.0025,
        disabled: false
      },
      scrollSpring: {
        dampingRatio: 1.0,
        period: 350
      },
      scrollSync: {scale: 0.2},
      overscroll: true,
      paginated: false,
      paginationMode: PaginationMode.PAGE,
      paginationEnergyThresshold: 0.01,
      alignment: 0,
      touchMoveDirectionThresshold: undefined,
      touchMoveNoVelocityDuration: 100,
      mouseMove: false,
      enabled: true,
      layoutAll: false,
      alwaysLayout: false,
      extraBoundsSpace: [100, 100],
      debug: false
    };
    ScrollController.prototype.setOptions = function(options) {
      LayoutController.prototype.setOptions.call(this, options);
      if (this._scroll) {
        if (options.scrollSpring) {
          this._scroll.springForce.setOptions(options.scrollSpring);
        }
        if (options.scrollDrag) {
          this._scroll.dragForce.setOptions(options.scrollDrag);
        }
      }
      if (options.scrollSync && this._scrollSync) {
        this._scrollSync.setOptions(options.scrollSync);
      }
      return this;
    };
    function _initLayoutNode(node, spec) {
      if (!spec && this.options.flowOptions.insertSpec) {
        node.setSpec(this.options.flowOptions.insertSpec);
      }
    }
    function _updateSpring() {
      var springValue = this._scroll.scrollForceCount ? undefined : this._scroll.springPosition;
      if (this._scroll.springValue !== springValue) {
        this._scroll.springValue = springValue;
        if (springValue === undefined) {
          if (this._scroll.springForceId !== undefined) {
            this._scroll.pe.detach(this._scroll.springForceId);
            this._scroll.springForceId = undefined;
          }
        } else {
          if (this._scroll.springForceId === undefined) {
            this._scroll.springForceId = this._scroll.pe.attach(this._scroll.springForce, this._scroll.particle);
          }
          this._scroll.springEndState.set1D(springValue);
          this._scroll.pe.wake();
        }
      }
    }
    function _mouseDown(event) {
      if (!this.options.mouseMove) {
        return ;
      }
      if (this._scroll.mouseMove) {
        this.releaseScrollForce(this._scroll.mouseMove.delta);
      }
      var current = [event.clientX, event.clientY];
      var time = Date.now();
      this._scroll.mouseMove = {
        delta: 0,
        start: current,
        current: current,
        prev: current,
        time: time,
        prevTime: time
      };
      this.applyScrollForce(this._scroll.mouseMove.delta);
    }
    function _mouseMove(event) {
      if (!this._scroll.mouseMove || !this.options.enabled) {
        return ;
      }
      var moveDirection = Math.atan2(Math.abs(event.clientY - this._scroll.mouseMove.prev[1]), Math.abs(event.clientX - this._scroll.mouseMove.prev[0])) / (Math.PI / 2.0);
      var directionDiff = Math.abs(this._direction - moveDirection);
      if ((this.options.touchMoveDirectionThresshold === undefined) || (directionDiff <= this.options.touchMoveDirectionThresshold)) {
        this._scroll.mouseMove.prev = this._scroll.mouseMove.current;
        this._scroll.mouseMove.current = [event.clientX, event.clientY];
        this._scroll.mouseMove.prevTime = this._scroll.mouseMove.time;
        this._scroll.mouseMove.direction = moveDirection;
        this._scroll.mouseMove.time = Date.now();
      }
      var delta = this._scroll.mouseMove.current[this._direction] - this._scroll.mouseMove.start[this._direction];
      this.updateScrollForce(this._scroll.mouseMove.delta, delta);
      this._scroll.mouseMove.delta = delta;
    }
    function _mouseUp(event) {
      if (!this._scroll.mouseMove) {
        return ;
      }
      var velocity = 0;
      var diffTime = this._scroll.mouseMove.time - this._scroll.mouseMove.prevTime;
      if ((diffTime > 0) && ((Date.now() - this._scroll.mouseMove.time) <= this.options.touchMoveNoVelocityDuration)) {
        var diffOffset = this._scroll.mouseMove.current[this._direction] - this._scroll.mouseMove.prev[this._direction];
        velocity = diffOffset / diffTime;
      }
      this.releaseScrollForce(this._scroll.mouseMove.delta, velocity);
      this._scroll.mouseMove = undefined;
    }
    function _touchStart(event) {
      if (!this._touchEndEventListener) {
        this._touchEndEventListener = function(event2) {
          event2.target.removeEventListener('touchend', this._touchEndEventListener);
          _touchEnd.call(this, event2);
        }.bind(this);
      }
      var oldTouchesCount = this._scroll.activeTouches.length;
      var i = 0;
      var j;
      var touchFound;
      while (i < this._scroll.activeTouches.length) {
        var activeTouch = this._scroll.activeTouches[i];
        touchFound = false;
        for (j = 0; j < event.touches.length; j++) {
          var touch = event.touches[j];
          if (touch.identifier === activeTouch.id) {
            touchFound = true;
            break;
          }
        }
        if (!touchFound) {
          this._scroll.activeTouches.splice(i, 1);
        } else {
          i++;
        }
      }
      for (i = 0; i < event.touches.length; i++) {
        var changedTouch = event.touches[i];
        touchFound = false;
        for (j = 0; j < this._scroll.activeTouches.length; j++) {
          if (this._scroll.activeTouches[j].id === changedTouch.identifier) {
            touchFound = true;
            break;
          }
        }
        if (!touchFound) {
          var current = [changedTouch.clientX, changedTouch.clientY];
          var time = Date.now();
          this._scroll.activeTouches.push({
            id: changedTouch.identifier,
            start: current,
            current: current,
            prev: current,
            time: time,
            prevTime: time
          });
          changedTouch.target.addEventListener('touchend', this._touchEndEventListener);
        }
      }
      if (!oldTouchesCount && this._scroll.activeTouches.length) {
        this.applyScrollForce(0);
        this._scroll.touchDelta = 0;
      }
    }
    function _touchMove(event) {
      if (!this.options.enabled) {
        return ;
      }
      var primaryTouch;
      for (var i = 0; i < event.changedTouches.length; i++) {
        var changedTouch = event.changedTouches[i];
        for (var j = 0; j < this._scroll.activeTouches.length; j++) {
          var touch = this._scroll.activeTouches[j];
          if (touch.id === changedTouch.identifier) {
            var moveDirection = Math.atan2(Math.abs(changedTouch.clientY - touch.prev[1]), Math.abs(changedTouch.clientX - touch.prev[0])) / (Math.PI / 2.0);
            var directionDiff = Math.abs(this._direction - moveDirection);
            if ((this.options.touchMoveDirectionThresshold === undefined) || (directionDiff <= this.options.touchMoveDirectionThresshold)) {
              touch.prev = touch.current;
              touch.current = [changedTouch.clientX, changedTouch.clientY];
              touch.prevTime = touch.time;
              touch.direction = moveDirection;
              touch.time = Date.now();
              primaryTouch = (j === 0) ? touch : undefined;
            }
          }
        }
      }
      if (primaryTouch) {
        var delta = primaryTouch.current[this._direction] - primaryTouch.start[this._direction];
        this.updateScrollForce(this._scroll.touchDelta, delta);
        this._scroll.touchDelta = delta;
      }
    }
    function _touchEnd(event) {
      var primaryTouch = this._scroll.activeTouches.length ? this._scroll.activeTouches[0] : undefined;
      for (var i = 0; i < event.changedTouches.length; i++) {
        var changedTouch = event.changedTouches[i];
        for (var j = 0; j < this._scroll.activeTouches.length; j++) {
          var touch = this._scroll.activeTouches[j];
          if (touch.id === changedTouch.identifier) {
            this._scroll.activeTouches.splice(j, 1);
            if ((j === 0) && this._scroll.activeTouches.length) {
              var newPrimaryTouch = this._scroll.activeTouches[0];
              newPrimaryTouch.start[0] = newPrimaryTouch.current[0] - (touch.current[0] - touch.start[0]);
              newPrimaryTouch.start[1] = newPrimaryTouch.current[1] - (touch.current[1] - touch.start[1]);
            }
            break;
          }
        }
      }
      if (!primaryTouch || this._scroll.activeTouches.length) {
        return ;
      }
      var velocity = 0;
      var diffTime = primaryTouch.time - primaryTouch.prevTime;
      if ((diffTime > 0) && ((Date.now() - primaryTouch.time) <= this.options.touchMoveNoVelocityDuration)) {
        var diffOffset = primaryTouch.current[this._direction] - primaryTouch.prev[this._direction];
        velocity = diffOffset / diffTime;
      }
      var delta = this._scroll.touchDelta;
      this.releaseScrollForce(delta, velocity);
      this._scroll.touchDelta = 0;
    }
    function _scrollUpdate(event) {
      if (!this.options.enabled) {
        return ;
      }
      var offset = Array.isArray(event.delta) ? event.delta[this._direction] : event.delta;
      this.scroll(offset);
    }
    function _setParticle(position, velocity, phase) {
      if (position !== undefined) {
        this._scroll.particleValue = position;
        this._scroll.particle.setPosition1D(position);
      }
      if (velocity !== undefined) {
        var oldVelocity = this._scroll.particle.getVelocity1D();
        if (oldVelocity !== velocity) {
          this._scroll.particle.setVelocity1D(velocity);
        }
      }
    }
    function _calcScrollOffset(normalize, refreshParticle) {
      if (refreshParticle || (this._scroll.particleValue === undefined)) {
        this._scroll.particleValue = this._scroll.particle.getPosition1D();
        this._scroll.particleValue = Math.round(this._scroll.particleValue * 1000) / 1000;
      }
      var scrollOffset = this._scroll.particleValue;
      if (this._scroll.scrollDelta || this._scroll.normalizedScrollDelta) {
        scrollOffset += this._scroll.scrollDelta + this._scroll.normalizedScrollDelta;
        if (((this._scroll.boundsReached & Bounds.PREV) && (scrollOffset > this._scroll.springPosition)) || ((this._scroll.boundsReached & Bounds.NEXT) && (scrollOffset < this._scroll.springPosition)) || (this._scroll.boundsReached === Bounds.BOTH)) {
          scrollOffset = this._scroll.springPosition;
        }
        if (normalize) {
          if (!this._scroll.scrollDelta) {
            this._scroll.normalizedScrollDelta = 0;
            _setParticle.call(this, scrollOffset, undefined, '_calcScrollOffset');
          }
          this._scroll.normalizedScrollDelta += this._scroll.scrollDelta;
          this._scroll.scrollDelta = 0;
        }
      }
      if (this._scroll.scrollForceCount && this._scroll.scrollForce) {
        if (this._scroll.springPosition !== undefined) {
          scrollOffset = (scrollOffset + this._scroll.scrollForce + this._scroll.springPosition) / 2.0;
        } else {
          scrollOffset += this._scroll.scrollForce;
        }
      }
      if (!this.options.overscroll) {
        if ((this._scroll.boundsReached === Bounds.BOTH) || ((this._scroll.boundsReached === Bounds.PREV) && (scrollOffset > this._scroll.springPosition)) || ((this._scroll.boundsReached === Bounds.NEXT) && (scrollOffset < this._scroll.springPosition))) {
          scrollOffset = this._scroll.springPosition;
        }
      }
      return scrollOffset;
    }
    ScrollController.prototype._calcScrollHeight = function(next, lastNodeOnly) {
      var calcedHeight = 0;
      var node = this._nodes.getStartEnumNode(next);
      while (node) {
        if (node._invalidated) {
          if (node.trueSizeRequested) {
            calcedHeight = undefined;
            break;
          }
          if (node.scrollLength !== undefined) {
            calcedHeight = lastNodeOnly ? node.scrollLength : (calcedHeight + node.scrollLength);
            if (!next && lastNodeOnly) {
              break;
            }
          }
        }
        node = next ? node._next : node._prev;
      }
      return calcedHeight;
    };
    function _calcBounds(size, scrollOffset) {
      var prevHeight = this._calcScrollHeight(false);
      var nextHeight = this._calcScrollHeight(true);
      var enforeMinSize = this._layout.capabilities && this._layout.capabilities.sequentialScrollingOptimized;
      var totalHeight;
      if (enforeMinSize) {
        if ((nextHeight !== undefined) && (prevHeight !== undefined)) {
          totalHeight = prevHeight + nextHeight;
        }
        if ((totalHeight !== undefined) && (totalHeight <= size[this._direction])) {
          this._scroll.boundsReached = Bounds.BOTH;
          this._scroll.springPosition = this.options.alignment ? -nextHeight : prevHeight;
          this._scroll.springSource = SpringSource.MINSIZE;
          return ;
        }
      }
      if (this.options.alignment) {
        if (enforeMinSize) {
          if ((nextHeight !== undefined) && ((scrollOffset + nextHeight) <= 0)) {
            this._scroll.boundsReached = Bounds.NEXT;
            this._scroll.springPosition = -nextHeight;
            this._scroll.springSource = SpringSource.NEXTBOUNDS;
            return ;
          }
        } else {
          var firstPrevItemHeight = this._calcScrollHeight(false, true);
          if ((nextHeight !== undefined) && firstPrevItemHeight && ((scrollOffset + nextHeight + size[this._direction]) <= firstPrevItemHeight)) {
            this._scroll.boundsReached = Bounds.NEXT;
            this._scroll.springPosition = nextHeight - (size[this._direction] - firstPrevItemHeight);
            this._scroll.springSource = SpringSource.NEXTBOUNDS;
            return ;
          }
        }
      } else {
        if ((prevHeight !== undefined) && ((scrollOffset - prevHeight) >= 0)) {
          this._scroll.boundsReached = Bounds.PREV;
          this._scroll.springPosition = prevHeight;
          this._scroll.springSource = SpringSource.PREVBOUNDS;
          return ;
        }
      }
      if (this.options.alignment) {
        if ((prevHeight !== undefined) && ((scrollOffset - prevHeight) >= -size[this._direction])) {
          this._scroll.boundsReached = Bounds.PREV;
          this._scroll.springPosition = -size[this._direction] + prevHeight;
          this._scroll.springSource = SpringSource.PREVBOUNDS;
          return ;
        }
      } else {
        var nextBounds = enforeMinSize ? size[this._direction] : this._calcScrollHeight(true, true);
        if ((nextHeight !== undefined) && ((scrollOffset + nextHeight) <= nextBounds)) {
          this._scroll.boundsReached = Bounds.NEXT;
          this._scroll.springPosition = nextBounds - nextHeight;
          this._scroll.springSource = SpringSource.NEXTBOUNDS;
          return ;
        }
      }
      this._scroll.boundsReached = Bounds.NONE;
      this._scroll.springPosition = undefined;
      this._scroll.springSource = SpringSource.NONE;
    }
    function _calcScrollToOffset(size, scrollOffset) {
      var scrollToRenderNode = this._scroll.scrollToRenderNode || this._scroll.ensureVisibleRenderNode;
      if (!scrollToRenderNode) {
        return ;
      }
      if ((this._scroll.boundsReached === Bounds.BOTH) || (!this._scroll.scrollToDirection && (this._scroll.boundsReached === Bounds.PREV)) || (this._scroll.scrollToDirection && (this._scroll.boundsReached === Bounds.NEXT))) {
        return ;
      }
      var foundNode;
      var scrollToOffset = 0;
      var node = this._nodes.getStartEnumNode(true);
      var count = 0;
      while (node) {
        count++;
        if (!node._invalidated || (node.scrollLength === undefined)) {
          break;
        }
        if (this.options.alignment) {
          scrollToOffset -= node.scrollLength;
        }
        if (node.renderNode === scrollToRenderNode) {
          foundNode = node;
          break;
        }
        if (!this.options.alignment) {
          scrollToOffset -= node.scrollLength;
        }
        node = node._next;
      }
      if (!foundNode) {
        scrollToOffset = 0;
        node = this._nodes.getStartEnumNode(false);
        while (node) {
          if (!node._invalidated || (node.scrollLength === undefined)) {
            break;
          }
          if (!this.options.alignment) {
            scrollToOffset += node.scrollLength;
          }
          if (node.renderNode === scrollToRenderNode) {
            foundNode = node;
            break;
          }
          if (this.options.alignment) {
            scrollToOffset += node.scrollLength;
          }
          node = node._prev;
        }
      }
      if (foundNode) {
        if (this._scroll.ensureVisibleRenderNode) {
          if (this.options.alignment) {
            if ((scrollToOffset - foundNode.scrollLength) < 0) {
              this._scroll.springPosition = scrollToOffset;
              this._scroll.springSource = SpringSource.ENSUREVISIBLE;
            } else if (scrollToOffset > size[this._direction]) {
              this._scroll.springPosition = size[this._direction] - scrollToOffset;
              this._scroll.springSource = SpringSource.ENSUREVISIBLE;
            } else {
              if (!foundNode.trueSizeRequested) {
                this._scroll.ensureVisibleRenderNode = undefined;
              }
            }
          } else {
            scrollToOffset = -scrollToOffset;
            if (scrollToOffset < 0) {
              this._scroll.springPosition = scrollToOffset;
              this._scroll.springSource = SpringSource.ENSUREVISIBLE;
            } else if ((scrollToOffset + foundNode.scrollLength) > size[this._direction]) {
              this._scroll.springPosition = size[this._direction] - (scrollToOffset + foundNode.scrollLength);
              this._scroll.springSource = SpringSource.ENSUREVISIBLE;
            } else {
              if (!foundNode.trueSizeRequested) {
                this._scroll.ensureVisibleRenderNode = undefined;
              }
            }
          }
        } else {
          this._scroll.springPosition = scrollToOffset;
          this._scroll.springSource = SpringSource.GOTOSEQUENCE;
        }
        return ;
      }
      if (this._scroll.scrollToDirection) {
        this._scroll.springPosition = scrollOffset - size[this._direction];
        this._scroll.springSource = SpringSource.GOTONEXTDIRECTION;
      } else {
        this._scroll.springPosition = scrollOffset + size[this._direction];
        this._scroll.springSource = SpringSource.GOTOPREVDIRECTION;
      }
      if (this._viewSequence.cleanup) {
        var viewSequence = this._viewSequence;
        while (viewSequence.get() !== scrollToRenderNode) {
          viewSequence = this._scroll.scrollToDirection ? viewSequence.getNext(true) : viewSequence.getPrevious(true);
          if (!viewSequence) {
            break;
          }
        }
      }
    }
    function _snapToPage() {
      if (!this.options.paginated || this._scroll.scrollForceCount || (this._scroll.springPosition !== undefined)) {
        return ;
      }
      var item;
      switch (this.options.paginationMode) {
        case PaginationMode.SCROLL:
          if (!this.options.paginationEnergyThresshold || (Math.abs(this._scroll.particle.getEnergy()) <= this.options.paginationEnergyThresshold)) {
            item = this.options.alignment ? this.getLastVisibleItem() : this.getFirstVisibleItem();
            if (item && item.renderNode) {
              this.goToRenderNode(item.renderNode);
            }
          }
          break;
        case PaginationMode.PAGE:
          item = this.options.alignment ? this.getLastVisibleItem() : this.getFirstVisibleItem();
          if (item && item.renderNode) {
            this.goToRenderNode(item.renderNode);
          }
          break;
      }
    }
    function _normalizePrevViewSequence(scrollOffset) {
      var count = 0;
      var normalizedScrollOffset = scrollOffset;
      var normalizeNextPrev = false;
      var node = this._nodes.getStartEnumNode(false);
      while (node) {
        if (!node._invalidated || !node._viewSequence) {
          break;
        }
        if (normalizeNextPrev) {
          this._viewSequence = node._viewSequence;
          normalizedScrollOffset = scrollOffset;
          normalizeNextPrev = false;
        }
        if ((node.scrollLength === undefined) || node.trueSizeRequested || (scrollOffset < 0)) {
          break;
        }
        scrollOffset -= node.scrollLength;
        count++;
        if (node.scrollLength) {
          if (this.options.alignment) {
            normalizeNextPrev = (scrollOffset >= 0);
          } else {
            this._viewSequence = node._viewSequence;
            normalizedScrollOffset = scrollOffset;
          }
        }
        node = node._prev;
      }
      return normalizedScrollOffset;
    }
    function _normalizeNextViewSequence(scrollOffset) {
      var count = 0;
      var normalizedScrollOffset = scrollOffset;
      var node = this._nodes.getStartEnumNode(true);
      while (node) {
        if (!node._invalidated || (node.scrollLength === undefined) || node.trueSizeRequested || !node._viewSequence || ((scrollOffset > 0) && (!this.options.alignment || (node.scrollLength !== 0)))) {
          break;
        }
        if (this.options.alignment) {
          scrollOffset += node.scrollLength;
          count++;
        }
        if (node.scrollLength || this.options.alignment) {
          this._viewSequence = node._viewSequence;
          normalizedScrollOffset = scrollOffset;
        }
        if (!this.options.alignment) {
          scrollOffset += node.scrollLength;
          count++;
        }
        node = node._next;
      }
      return normalizedScrollOffset;
    }
    function _normalizeViewSequence(size, scrollOffset) {
      var caps = this._layout.capabilities;
      if (caps && caps.debug && (caps.debug.normalize !== undefined) && !caps.debug.normalize) {
        return scrollOffset;
      }
      if (this._scroll.scrollForceCount) {
        return scrollOffset;
      }
      var normalizedScrollOffset = scrollOffset;
      if (this.options.alignment && (scrollOffset < 0)) {
        normalizedScrollOffset = _normalizeNextViewSequence.call(this, scrollOffset);
      } else if (!this.options.alignment && (scrollOffset > 0)) {
        normalizedScrollOffset = _normalizePrevViewSequence.call(this, scrollOffset);
      }
      if (normalizedScrollOffset === scrollOffset) {
        if (this.options.alignment && (scrollOffset > 0)) {
          normalizedScrollOffset = _normalizePrevViewSequence.call(this, scrollOffset);
        } else if (!this.options.alignment && (scrollOffset < 0)) {
          normalizedScrollOffset = _normalizeNextViewSequence.call(this, scrollOffset);
        }
      }
      if (normalizedScrollOffset !== scrollOffset) {
        var delta = normalizedScrollOffset - scrollOffset;
        var particleValue = this._scroll.particle.getPosition1D();
        _setParticle.call(this, particleValue + delta, undefined, 'normalize');
        if (this._scroll.springPosition !== undefined) {
          this._scroll.springPosition += delta;
        }
        if (caps && caps.sequentialScrollingOptimized) {
          this._scroll.groupStart -= delta;
        }
      }
      return normalizedScrollOffset;
    }
    ScrollController.prototype.getVisibleItems = function() {
      var size = this._contextSizeCache;
      var scrollOffset = this.options.alignment ? (this._scroll.unnormalizedScrollOffset + size[this._direction]) : this._scroll.unnormalizedScrollOffset;
      var result = [];
      var node = this._nodes.getStartEnumNode(true);
      while (node) {
        if (!node._invalidated || (node.scrollLength === undefined) || (scrollOffset > size[this._direction])) {
          break;
        }
        scrollOffset += node.scrollLength;
        if ((scrollOffset >= 0) && node._viewSequence) {
          result.push({
            index: node._viewSequence.getIndex(),
            viewSequence: node._viewSequence,
            renderNode: node.renderNode,
            visiblePerc: node.scrollLength ? ((Math.min(scrollOffset, size[this._direction]) - Math.max(scrollOffset - node.scrollLength, 0)) / node.scrollLength) : 1,
            scrollOffset: scrollOffset - node.scrollLength,
            scrollLength: node.scrollLength,
            _node: node
          });
        }
        node = node._next;
      }
      scrollOffset = this.options.alignment ? (this._scroll.unnormalizedScrollOffset + size[this._direction]) : this._scroll.unnormalizedScrollOffset;
      node = this._nodes.getStartEnumNode(false);
      while (node) {
        if (!node._invalidated || (node.scrollLength === undefined) || (scrollOffset < 0)) {
          break;
        }
        scrollOffset -= node.scrollLength;
        if ((scrollOffset < size[this._direction]) && node._viewSequence) {
          result.unshift({
            index: node._viewSequence.getIndex(),
            viewSequence: node._viewSequence,
            renderNode: node.renderNode,
            visiblePerc: node.scrollLength ? ((Math.min(scrollOffset + node.scrollLength, size[this._direction]) - Math.max(scrollOffset, 0)) / node.scrollLength) : 1,
            scrollOffset: scrollOffset,
            scrollLength: node.scrollLength,
            _node: node
          });
        }
        node = node._prev;
      }
      return result;
    };
    function _getVisibleItem(first) {
      var result = {};
      var diff;
      var prevDiff = 10000000;
      var diffDelta = (first && this.options.alignment) ? -this._contextSizeCache[this._direction] : ((!first && !this.options.alignment) ? this._contextSizeCache[this._direction] : 0);
      var scrollOffset = this._scroll.unnormalizedScrollOffset;
      var node = this._nodes.getStartEnumNode(true);
      while (node) {
        if (!node._invalidated || (node.scrollLength === undefined)) {
          break;
        }
        if (node._viewSequence) {
          diff = Math.abs(diffDelta - (scrollOffset + (!first ? node.scrollLength : 0)));
          if (diff >= prevDiff) {
            break;
          }
          prevDiff = diff;
          result.scrollOffset = scrollOffset;
          result._node = node;
          scrollOffset += node.scrollLength;
        }
        node = node._next;
      }
      scrollOffset = this._scroll.unnormalizedScrollOffset;
      node = this._nodes.getStartEnumNode(false);
      while (node) {
        if (!node._invalidated || (node.scrollLength === undefined)) {
          break;
        }
        if (node._viewSequence) {
          scrollOffset -= node.scrollLength;
          diff = Math.abs(diffDelta - (scrollOffset + (!first ? node.scrollLength : 0)));
          if (diff >= prevDiff) {
            break;
          }
          prevDiff = diff;
          result.scrollOffset = scrollOffset;
          result._node = node;
        }
        node = node._prev;
      }
      if (!result._node) {
        return undefined;
      }
      result.scrollLength = result._node.scrollLength;
      if (this.options.alignment) {
        result.visiblePerc = (Math.min(result.scrollOffset + result.scrollLength, 0) - Math.max(result.scrollOffset, -this._contextSizeCache[this._direction])) / result.scrollLength;
      } else {
        result.visiblePerc = (Math.min(result.scrollOffset + result.scrollLength, this._contextSizeCache[this._direction]) - Math.max(result.scrollOffset, 0)) / result.scrollLength;
      }
      result.index = result._node._viewSequence.getIndex();
      result.viewSequence = result._node._viewSequence;
      result.renderNode = result._node.renderNode;
      return result;
    }
    ScrollController.prototype.getFirstVisibleItem = function() {
      return _getVisibleItem.call(this, true);
    };
    ScrollController.prototype.getLastVisibleItem = function() {
      return _getVisibleItem.call(this, false);
    };
    function _goToSequence(viewSequence, next, noAnimation) {
      if (noAnimation) {
        this._viewSequence = viewSequence;
        this._scroll.springPosition = undefined;
        _updateSpring.call(this);
        this.halt();
        this._scroll.scrollDelta = 0;
        _setParticle.call(this, 0, 0, '_goToSequence');
        this._isDirty = true;
      } else {
        this._scroll.scrollToSequence = viewSequence;
        this._scroll.scrollToRenderNode = viewSequence.get();
        this._scroll.ensureVisibleRenderNode = undefined;
        this._scroll.scrollToDirection = next;
        this._scroll.scrollDirty = true;
      }
    }
    function _ensureVisibleSequence(viewSequence, next) {
      this._scroll.scrollToSequence = undefined;
      this._scroll.scrollToRenderNode = undefined;
      this._scroll.ensureVisibleRenderNode = viewSequence.get();
      this._scroll.scrollToDirection = next;
      this._scroll.scrollDirty = true;
    }
    function _goToPage(amount, noAnimation) {
      var viewSequence = (!noAnimation ? this._scroll.scrollToSequence : undefined) || this._viewSequence;
      if (!this._scroll.scrollToSequence && !noAnimation) {
        var firstVisibleItem = this.getFirstVisibleItem();
        if (firstVisibleItem) {
          viewSequence = firstVisibleItem.viewSequence;
          if (((amount < 0) && (firstVisibleItem.scrollOffset < 0)) || ((amount > 0) && (firstVisibleItem.scrollOffset > 0))) {
            amount = 0;
          }
        }
      }
      if (!viewSequence) {
        return ;
      }
      for (var i = 0; i < Math.abs(amount); i++) {
        var nextViewSequence = (amount > 0) ? viewSequence.getNext() : viewSequence.getPrevious();
        if (nextViewSequence) {
          viewSequence = nextViewSequence;
        } else {
          break;
        }
      }
      _goToSequence.call(this, viewSequence, amount >= 0, noAnimation);
    }
    ScrollController.prototype.goToFirstPage = function(noAnimation) {
      if (!this._viewSequence) {
        return this;
      }
      if (this._viewSequence._ && this._viewSequence._.loop) {
        LayoutUtility.error('Unable to go to first item of looped ViewSequence');
        return this;
      }
      var viewSequence = this._viewSequence;
      while (viewSequence) {
        var prev = viewSequence.getPrevious();
        if (prev && prev.get()) {
          viewSequence = prev;
        } else {
          break;
        }
      }
      _goToSequence.call(this, viewSequence, false, noAnimation);
      return this;
    };
    ScrollController.prototype.goToPreviousPage = function(noAnimation) {
      _goToPage.call(this, -1, noAnimation);
      return this;
    };
    ScrollController.prototype.goToNextPage = function(noAnimation) {
      _goToPage.call(this, 1, noAnimation);
      return this;
    };
    ScrollController.prototype.goToLastPage = function(noAnimation) {
      if (!this._viewSequence) {
        return this;
      }
      if (this._viewSequence._ && this._viewSequence._.loop) {
        LayoutUtility.error('Unable to go to last item of looped ViewSequence');
        return this;
      }
      var viewSequence = this._viewSequence;
      while (viewSequence) {
        var next = viewSequence.getNext();
        if (next && next.get()) {
          viewSequence = next;
        } else {
          break;
        }
      }
      _goToSequence.call(this, viewSequence, true, noAnimation);
      return this;
    };
    ScrollController.prototype.goToRenderNode = function(node, noAnimation) {
      if (!this._viewSequence || !node) {
        return this;
      }
      if (this._viewSequence.get() === node) {
        var next = _calcScrollOffset.call(this) >= 0;
        _goToSequence.call(this, this._viewSequence, next, noAnimation);
        return this;
      }
      var nextSequence = this._viewSequence.getNext();
      var prevSequence = this._viewSequence.getPrevious();
      while ((nextSequence || prevSequence) && (nextSequence !== this._viewSequence)) {
        var nextNode = nextSequence ? nextSequence.get() : undefined;
        if (nextNode === node) {
          _goToSequence.call(this, nextSequence, true, noAnimation);
          break;
        }
        var prevNode = prevSequence ? prevSequence.get() : undefined;
        if (prevNode === node) {
          _goToSequence.call(this, prevSequence, false, noAnimation);
          break;
        }
        nextSequence = nextNode ? nextSequence.getNext() : undefined;
        prevSequence = prevNode ? prevSequence.getPrevious() : undefined;
      }
      return this;
    };
    ScrollController.prototype.ensureVisible = function(node) {
      if (node instanceof ViewSequence) {
        node = node.get();
      } else if ((node instanceof Number) || (typeof node === 'number')) {
        var viewSequence = this._viewSequence;
        while (viewSequence.getIndex() < node) {
          viewSequence = viewSequence.getNext();
          if (!viewSequence) {
            return this;
          }
        }
        while (viewSequence.getIndex() > node) {
          viewSequence = viewSequence.getPrevious();
          if (!viewSequence) {
            return this;
          }
        }
      }
      if (this._viewSequence.get() === node) {
        var next = _calcScrollOffset.call(this) >= 0;
        _ensureVisibleSequence.call(this, this._viewSequence, next);
        return this;
      }
      var nextSequence = this._viewSequence.getNext();
      var prevSequence = this._viewSequence.getPrevious();
      while ((nextSequence || prevSequence) && (nextSequence !== this._viewSequence)) {
        var nextNode = nextSequence ? nextSequence.get() : undefined;
        if (nextNode === node) {
          _ensureVisibleSequence.call(this, nextSequence, true);
          break;
        }
        var prevNode = prevSequence ? prevSequence.get() : undefined;
        if (prevNode === node) {
          _ensureVisibleSequence.call(this, prevSequence, false);
          break;
        }
        nextSequence = nextNode ? nextSequence.getNext() : undefined;
        prevSequence = prevNode ? prevSequence.getPrevious() : undefined;
      }
      return this;
    };
    ScrollController.prototype.scroll = function(delta) {
      this.halt();
      this._scroll.scrollDelta += delta;
      return this;
    };
    ScrollController.prototype.canScroll = function(delta) {
      var scrollOffset = _calcScrollOffset.call(this);
      var prevHeight = this._calcScrollHeight(false);
      var nextHeight = this._calcScrollHeight(true);
      var totalHeight;
      if ((nextHeight !== undefined) && (prevHeight !== undefined)) {
        totalHeight = prevHeight + nextHeight;
      }
      if ((totalHeight !== undefined) && (totalHeight <= this._contextSizeCache[this._direction])) {
        return 0;
      }
      if ((delta < 0) && (nextHeight !== undefined)) {
        var nextOffset = this._contextSizeCache[this._direction] - (scrollOffset + nextHeight);
        return Math.max(nextOffset, delta);
      } else if ((delta > 0) && (prevHeight !== undefined)) {
        var prevOffset = -(scrollOffset - prevHeight);
        return Math.min(prevOffset, delta);
      }
      return delta;
    };
    ScrollController.prototype.halt = function() {
      this._scroll.scrollToSequence = undefined;
      this._scroll.scrollToRenderNode = undefined;
      this._scroll.ensureVisibleRenderNode = undefined;
      _setParticle.call(this, undefined, 0, 'halt');
      return this;
    };
    ScrollController.prototype.isScrolling = function() {
      return this._scroll.isScrolling;
    };
    ScrollController.prototype.getBoundsReached = function() {
      return this._scroll.boundsReached;
    };
    ScrollController.prototype.getVelocity = function() {
      return this._scroll.particle.getVelocity1D();
    };
    ScrollController.prototype.getEnergy = function() {
      return this._scroll.particle.getEnergy();
    };
    ScrollController.prototype.setVelocity = function(velocity) {
      return this._scroll.particle.setVelocity1D(velocity);
    };
    ScrollController.prototype.applyScrollForce = function(delta) {
      this.halt();
      if (this._scroll.scrollForceCount === 0) {
        this._scroll.scrollForceStartItem = this.options.alignment ? this.getLastVisibleItem() : this.getFirstVisibleItem();
      }
      this._scroll.scrollForceCount++;
      this._scroll.scrollForce += delta;
      return this;
    };
    ScrollController.prototype.updateScrollForce = function(prevDelta, newDelta) {
      this.halt();
      newDelta -= prevDelta;
      this._scroll.scrollForce += newDelta;
      return this;
    };
    ScrollController.prototype.releaseScrollForce = function(delta, velocity) {
      this.halt();
      if (this._scroll.scrollForceCount === 1) {
        var scrollOffset = _calcScrollOffset.call(this);
        _setParticle.call(this, scrollOffset, velocity, 'releaseScrollForce');
        this._scroll.pe.wake();
        this._scroll.scrollForce = 0;
        this._scroll.scrollDirty = true;
        if (this._scroll.scrollForceStartItem && this.options.paginated && (this.options.paginationMode === PaginationMode.PAGE)) {
          var item = this.options.alignment ? this.getLastVisibleItem(true) : this.getFirstVisibleItem(true);
          if (item) {
            if (item.renderNode !== this._scroll.scrollForceStartItem.renderNode) {
              this.goToRenderNode(item.renderNode);
            } else if (this.options.paginationEnergyThresshold && (Math.abs(this._scroll.particle.getEnergy()) >= this.options.paginationEnergyThresshold)) {
              velocity = velocity || 0;
              if ((velocity < 0) && item._node._next && item._node._next.renderNode) {
                this.goToRenderNode(item._node._next.renderNode);
              } else if ((velocity >= 0) && item._node._prev && item._node._prev.renderNode) {
                this.goToRenderNode(item._node._prev.renderNode);
              }
            } else {
              this.goToRenderNode(item.renderNode);
            }
          }
        }
        this._scroll.scrollForceStartItem = undefined;
      } else {
        this._scroll.scrollForce -= delta;
      }
      this._scroll.scrollForceCount--;
      return this;
    };
    ScrollController.prototype.getSpec = function(node, normalize) {
      var spec = LayoutController.prototype.getSpec.apply(this, arguments);
      if (spec && this._layout.capabilities && this._layout.capabilities.sequentialScrollingOptimized) {
        spec = {
          origin: spec.origin,
          align: spec.align,
          opacity: spec.opacity,
          size: spec.size,
          renderNode: spec.renderNode,
          transform: spec.transform
        };
        var translate = [0, 0, 0];
        translate[this._direction] = this._scrollOffsetCache + this._scroll.groupStart;
        spec.transform = Transform.thenMove(spec.transform, translate);
      }
      return spec;
    };
    function _layout(size, scrollOffset, nested) {
      this._debug.layoutCount++;
      var scrollStart = 0 - Math.max(this.options.extraBoundsSpace[0], 1);
      var scrollEnd = size[this._direction] + Math.max(this.options.extraBoundsSpace[1], 1);
      if (this.options.layoutAll) {
        scrollStart = -1000000;
        scrollEnd = 1000000;
      }
      var layoutContext = this._nodes.prepareForLayout(this._viewSequence, this._nodesById, {
        size: size,
        direction: this._direction,
        reverse: this.options.alignment ? true : false,
        scrollOffset: this.options.alignment ? (scrollOffset + size[this._direction]) : scrollOffset,
        scrollStart: scrollStart,
        scrollEnd: scrollEnd
      });
      if (this._layout._function) {
        this._layout._function(layoutContext, this._layout.options);
      }
      this._scroll.unnormalizedScrollOffset = scrollOffset;
      if (this._postLayout) {
        this._postLayout(size, scrollOffset);
      }
      this._nodes.removeNonInvalidatedNodes(this.options.flowOptions.removeSpec);
      _calcBounds.call(this, size, scrollOffset);
      _calcScrollToOffset.call(this, size, scrollOffset);
      _snapToPage.call(this);
      var newScrollOffset = _calcScrollOffset.call(this, true);
      if (!nested && (newScrollOffset !== scrollOffset)) {
        return _layout.call(this, size, newScrollOffset, true);
      }
      scrollOffset = _normalizeViewSequence.call(this, size, scrollOffset);
      _updateSpring.call(this);
      this._nodes.removeVirtualViewSequenceNodes();
      if (this.options.size && (this.options.size[this._direction] === true)) {
        var scrollLength = 0;
        var node = this._nodes.getStartEnumNode();
        while (node) {
          if (node._invalidated && node.scrollLength) {
            scrollLength += node.scrollLength;
          }
          node = node._next;
        }
        this._size = this._size || [0, 0];
        this._size[0] = this.options.size[0];
        this._size[1] = this.options.size[1];
        this._size[this._direction] = scrollLength;
      }
      return scrollOffset;
    }
    function _innerRender() {
      var specs = this._specs;
      for (var i3 = 0,
          j3 = specs.length; i3 < j3; i3++) {
        if (specs[i3].renderNode) {
          specs[i3].target = specs[i3].renderNode.render();
        }
      }
      if (!specs.length || (specs[specs.length - 1] !== this._cleanupRegistration)) {
        specs.push(this._cleanupRegistration);
      }
      return specs;
    }
    ScrollController.prototype.commit = function commit(context) {
      var size = context.size;
      this._debug.commitCount++;
      if (this._resetFlowState) {
        this._resetFlowState = false;
        this._isDirty = true;
        this._nodes.removeAll();
      }
      var scrollOffset = _calcScrollOffset.call(this, true, true);
      if (this._scrollOffsetCache === undefined) {
        this._scrollOffsetCache = scrollOffset;
      }
      var emitEndScrollingEvent = false;
      var emitScrollEvent = false;
      var eventData;
      if (size[0] !== this._contextSizeCache[0] || size[1] !== this._contextSizeCache[1] || this._isDirty || this._scroll.scrollDirty || this._nodes._trueSizeRequested || this.options.alwaysLayout || this._scrollOffsetCache !== scrollOffset) {
        eventData = {
          target: this,
          oldSize: this._contextSizeCache,
          size: size,
          oldScrollOffset: -(this._scrollOffsetCache + this._scroll.groupStart),
          scrollOffset: -(scrollOffset + this._scroll.groupStart)
        };
        if (this._scrollOffsetCache !== scrollOffset) {
          if (!this._scroll.isScrolling) {
            this._scroll.isScrolling = true;
            this._eventOutput.emit('scrollstart', eventData);
          }
          emitScrollEvent = true;
        } else if (this._scroll.isScrolling && !this._scroll.scrollForceCount) {
          emitEndScrollingEvent = true;
        }
        this._eventOutput.emit('layoutstart', eventData);
        if (this.options.flow && (this._isDirty || (this.options.flowOptions.reflowOnResize && ((size[0] !== this._contextSizeCache[0]) || (size[1] !== this._contextSizeCache[1]))))) {
          var node = this._nodes.getStartEnumNode();
          while (node) {
            node.releaseLock(true);
            node = node._next;
          }
        }
        this._contextSizeCache[0] = size[0];
        this._contextSizeCache[1] = size[1];
        this._isDirty = false;
        this._scroll.scrollDirty = false;
        scrollOffset = _layout.call(this, size, scrollOffset);
        this._scrollOffsetCache = scrollOffset;
        eventData.scrollOffset = -(this._scrollOffsetCache + this._scroll.groupStart);
      } else if (this._scroll.isScrolling && !this._scroll.scrollForceCount) {
        emitEndScrollingEvent = true;
      }
      var groupTranslate = this._scroll.groupTranslate;
      groupTranslate[0] = 0;
      groupTranslate[1] = 0;
      groupTranslate[2] = 0;
      groupTranslate[this._direction] = -this._scroll.groupStart - scrollOffset;
      var sequentialScrollingOptimized = this._layout.capabilities ? this._layout.capabilities.sequentialScrollingOptimized : false;
      var result = this._nodes.buildSpecAndDestroyUnrenderedNodes(sequentialScrollingOptimized ? groupTranslate : undefined);
      this._specs = result.specs;
      if (!this._specs.length) {
        this._scroll.groupStart = 0;
      }
      if (eventData) {
        this._eventOutput.emit('layoutend', eventData);
      }
      if (result.modified) {
        this._eventOutput.emit('reflow', {target: this});
      }
      if (emitScrollEvent) {
        this._eventOutput.emit('scroll', eventData);
      }
      if (eventData) {
        var visibleItem = this.options.alignment ? this.getLastVisibleItem() : this.getFirstVisibleItem();
        if ((visibleItem && !this._visibleItemCache) || (!visibleItem && this._visibleItemCache) || (visibleItem && this._visibleItemCache && (visibleItem.renderNode !== this._visibleItemCache.renderNode))) {
          this._eventOutput.emit('pagechange', {
            target: this,
            oldViewSequence: this._visibleItemCache ? this._visibleItemCache.viewSequence : undefined,
            viewSequence: visibleItem ? visibleItem.viewSequence : undefined,
            oldIndex: this._visibleItemCache ? this._visibleItemCache.index : undefined,
            index: visibleItem ? visibleItem.index : undefined,
            renderNode: visibleItem ? visibleItem.renderNode : undefined,
            oldRenderNode: this._visibleItemCache ? this._visibleItemCache.renderNode : undefined
          });
          this._visibleItemCache = visibleItem;
        }
      }
      if (emitEndScrollingEvent) {
        this._scroll.isScrolling = false;
        eventData = {
          target: this,
          oldSize: size,
          size: size,
          oldScrollOffset: -(this._scroll.groupStart + scrollOffset),
          scrollOffset: -(this._scroll.groupStart + scrollOffset)
        };
        this._eventOutput.emit('scrollend', eventData);
      }
      var transform = context.transform;
      if (sequentialScrollingOptimized) {
        var windowOffset = scrollOffset + this._scroll.groupStart;
        var translate = [0, 0, 0];
        translate[this._direction] = windowOffset;
        transform = Transform.thenMove(transform, translate);
      }
      return {
        transform: transform,
        size: size,
        opacity: context.opacity,
        origin: context.origin,
        target: this.group.render()
      };
    };
    ScrollController.prototype.render = function render() {
      if (this.container) {
        return this.container.render.apply(this.container, arguments);
      } else {
        return this.id;
      }
    };
    module.exports = ScrollController;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("views/MainFlippedView", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/View", "utils/objectHelper", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface", "github:ijzerenhein/famous-flex@0.3.1/src/FlexScrollView", "npm:famous@0.3.5/utilities/Utility", "npm:famous@0.3.5/views/Flipper", "views/NewChupsView"], function($__export) {
  "use strict";
  var __moduleName = "views/MainFlippedView";
  var Engine,
      Surface,
      View,
      ObjectHelper,
      LayoutController,
      BkImageSurface,
      FlexScrollView,
      Utility,
      Flipper,
      NewChupsView,
      MainFlippedView;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      BkImageSurface = $__m.default;
    }, function($__m) {
      FlexScrollView = $__m.default;
    }, function($__m) {
      Utility = $__m.default;
    }, function($__m) {
      Flipper = $__m.default;
    }, function($__m) {
      NewChupsView = $__m.NewChupsView;
    }],
    execute: function() {
      MainFlippedView = $__export("MainFlippedView", (function($__super) {
        var MainFlippedView = function MainFlippedView() {
          $traceurRuntime.superConstructor(MainFlippedView).call(this);
          ObjectHelper.bindAllMethods(this, this);
          ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
          ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');
          this.setFront(new NewChupsView());
          this.setBack(new Surface({
            content: 'back',
            properties: {
              background: 'blue',
              color: 'white',
              lineHeight: '200px',
              textAlign: 'center'
            }
          }));
        };
        return ($traceurRuntime.createClass)(MainFlippedView, {}, {}, $__super);
      }(Flipper)));
    }
  };
});



System.register("github:firebase/firebase-bower@2.2.4", ["github:firebase/firebase-bower@2.2.4/firebase"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("github:firebase/firebase-bower@2.2.4/firebase");
  global.define = __define;
  return module.exports;
});



System.register("DefaultContext", ["github:angular/di.js@master", "routers/ArvaRouter", "npm:famous@0.3.5/core/Engine", "github:Bizboard/arva-context@master/Context", "github:ijzerenhein/famous-flex@0.3.1/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "DefaultContext";
  var Injector,
      annotate,
      Provide,
      ArvaRouter,
      Engine,
      Context,
      AnimationController;
  function NewAnimationController() {
    var context = Engine.createContext();
    var controller = new AnimationController();
    context.add(controller);
    return controller;
  }
  function GetDefaultContext() {
    return Context.getContext('Default');
  }
  function ReCreateDefaultContext() {
    var dataSource = arguments[0] !== (void 0) ? arguments[0] : null;
    if (dataSource)
      Context.setContext('Default', new Injector([ArvaRouter, NewAnimationController, dataSource]));
    else
      Context.setContext('Default', new Injector([ArvaRouter, NewAnimationController]));
    return Context.getContext('Default');
  }
  $__export("GetDefaultContext", GetDefaultContext);
  $__export("ReCreateDefaultContext", ReCreateDefaultContext);
  return {
    setters: [function($__m) {
      Injector = $__m.Injector;
      annotate = $__m.annotate;
      Provide = $__m.Provide;
    }, function($__m) {
      ArvaRouter = $__m.ArvaRouter;
    }, function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Context = $__m.Context;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      annotate(NewAnimationController, new Provide(AnimationController));
    }
  };
});



System.register("github:angular/di.js@master/injector", ["github:angular/di.js@master/annotations", "github:angular/di.js@master/util", "github:angular/di.js@master/profiler", "github:angular/di.js@master/providers"], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master/injector";
  var annotate,
      readAnnotations,
      hasAnnotation,
      ProvideAnnotation,
      TransientScopeAnnotation,
      isFunction,
      toString,
      profileInjector,
      createProviderFromFnOrClass,
      Injector;
  function constructResolvingMessage(resolving, token) {
    if (arguments.length > 1) {
      resolving.push(token);
    }
    if (resolving.length > 1) {
      return (" (" + resolving.map(toString).join(' -> ') + ")");
    }
    return '';
  }
  return {
    setters: [function($__m) {
      annotate = $__m.annotate;
      readAnnotations = $__m.readAnnotations;
      hasAnnotation = $__m.hasAnnotation;
      ProvideAnnotation = $__m.Provide;
      TransientScopeAnnotation = $__m.TransientScope;
    }, function($__m) {
      isFunction = $__m.isFunction;
      toString = $__m.toString;
    }, function($__m) {
      profileInjector = $__m.profileInjector;
    }, function($__m) {
      createProviderFromFnOrClass = $__m.createProviderFromFnOrClass;
    }],
    execute: function() {
      Injector = (function() {
        var Injector = function Injector() {
          var modules = arguments[0] !== (void 0) ? arguments[0] : [];
          var parentInjector = arguments[1] !== (void 0) ? arguments[1] : null;
          var providers = arguments[2] !== (void 0) ? arguments[2] : new Map();
          var scopes = arguments[3] !== (void 0) ? arguments[3] : [];
          this._cache = new Map();
          this._providers = providers;
          this._parent = parentInjector;
          this._scopes = scopes;
          this._loadModules(modules);
          profileInjector(this, Injector);
        };
        return ($traceurRuntime.createClass)(Injector, {
          _collectProvidersWithAnnotation: function(annotationClass, collectedProviders) {
            this._providers.forEach((function(provider, token) {
              if (!collectedProviders.has(token) && hasAnnotation(provider.provider, annotationClass)) {
                collectedProviders.set(token, provider);
              }
            }));
            if (this._parent) {
              this._parent._collectProvidersWithAnnotation(annotationClass, collectedProviders);
            }
          },
          _loadModules: function(modules) {
            for (var $__2 = modules[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__3 = void 0; !($__3 = $__2.next()).done; ) {
              var module = $__3.value;
              {
                if (isFunction(module)) {
                  this._loadFnOrClass(module);
                  continue;
                }
                throw new Error('Invalid module!');
              }
            }
          },
          _loadFnOrClass: function(fnOrClass) {
            var annotations = readAnnotations(fnOrClass);
            var token = annotations.provide.token || fnOrClass;
            var provider = createProviderFromFnOrClass(fnOrClass, annotations);
            this._providers.set(token, provider);
          },
          _hasProviderFor: function(token) {
            if (this._providers.has(token)) {
              return true;
            }
            if (this._parent) {
              return this._parent._hasProviderFor(token);
            }
            return false;
          },
          _instantiateDefaultProvider: function(provider, token, resolving, wantPromise, wantLazy) {
            if (!this._parent) {
              this._providers.set(token, provider);
              return this.get(token, resolving, wantPromise, wantLazy);
            }
            for (var $__2 = this._scopes[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__3 = void 0; !($__3 = $__2.next()).done; ) {
              var ScopeClass = $__3.value;
              {
                if (hasAnnotation(provider.provider, ScopeClass)) {
                  this._providers.set(token, provider);
                  return this.get(token, resolving, wantPromise, wantLazy);
                }
              }
            }
            return this._parent._instantiateDefaultProvider(provider, token, resolving, wantPromise, wantLazy);
          },
          get: function(token) {
            var resolving = arguments[1] !== (void 0) ? arguments[1] : [];
            var wantPromise = arguments[2] !== (void 0) ? arguments[2] : false;
            var wantLazy = arguments[3] !== (void 0) ? arguments[3] : false;
            var $__0 = this;
            var resolvingMsg = '';
            var provider;
            var instance;
            var injector = this;
            if (token === null || token === undefined) {
              resolvingMsg = constructResolvingMessage(resolving, token);
              throw new Error(("Invalid token \"" + token + "\" requested!" + resolvingMsg));
            }
            if (token === Injector) {
              if (wantPromise) {
                return Promise.resolve(this);
              }
              return this;
            }
            if (wantLazy) {
              return function createLazyInstance() {
                var lazyInjector = injector;
                if (arguments.length) {
                  var locals = [];
                  var args = arguments;
                  for (var i = 0; i < args.length; i += 2) {
                    locals.push((function(ii) {
                      var fn = function createLocalInstance() {
                        return args[ii + 1];
                      };
                      annotate(fn, new ProvideAnnotation(args[ii]));
                      return fn;
                    })(i));
                  }
                  lazyInjector = injector.createChild(locals);
                }
                return lazyInjector.get(token, resolving, wantPromise, false);
              };
            }
            if (this._cache.has(token)) {
              instance = this._cache.get(token);
              provider = this._providers.get(token);
              if (provider.isPromise && !wantPromise) {
                resolvingMsg = constructResolvingMessage(resolving, token);
                throw new Error(("Cannot instantiate " + toString(token) + " synchronously. It is provided as a promise!" + resolvingMsg));
              }
              if (!provider.isPromise && wantPromise) {
                return Promise.resolve(instance);
              }
              return instance;
            }
            provider = this._providers.get(token);
            if (!provider && isFunction(token) && !this._hasProviderFor(token)) {
              provider = createProviderFromFnOrClass(token, readAnnotations(token));
              return this._instantiateDefaultProvider(provider, token, resolving, wantPromise, wantLazy);
            }
            if (!provider) {
              if (!this._parent) {
                resolvingMsg = constructResolvingMessage(resolving, token);
                throw new Error(("No provider for " + toString(token) + "!" + resolvingMsg));
              }
              return this._parent.get(token, resolving, wantPromise, wantLazy);
            }
            if (resolving.indexOf(token) !== -1) {
              resolvingMsg = constructResolvingMessage(resolving, token);
              throw new Error(("Cannot instantiate cyclic dependency!" + resolvingMsg));
            }
            resolving.push(token);
            var delayingInstantiation = wantPromise && provider.params.some((function(param) {
              return !param.isPromise;
            }));
            var args = provider.params.map((function(param) {
              if (delayingInstantiation) {
                return $__0.get(param.token, resolving, true, param.isLazy);
              }
              return $__0.get(param.token, resolving, param.isPromise, param.isLazy);
            }));
            if (delayingInstantiation) {
              var delayedResolving = resolving.slice();
              resolving.pop();
              return Promise.all(args).then(function(args) {
                try {
                  instance = provider.create(args);
                } catch (e) {
                  resolvingMsg = constructResolvingMessage(delayedResolving);
                  var originalMsg = 'ORIGINAL ERROR: ' + e.message;
                  e.message = ("Error during instantiation of " + toString(token) + "!" + resolvingMsg + "\n" + originalMsg);
                  throw e;
                }
                if (!hasAnnotation(provider.provider, TransientScopeAnnotation)) {
                  injector._cache.set(token, instance);
                }
                return instance;
              });
            }
            try {
              instance = provider.create(args);
            } catch (e) {
              resolvingMsg = constructResolvingMessage(resolving);
              var originalMsg = 'ORIGINAL ERROR: ' + e.message;
              e.message = ("Error during instantiation of " + toString(token) + "!" + resolvingMsg + "\n" + originalMsg);
              throw e;
            }
            if (!hasAnnotation(provider.provider, TransientScopeAnnotation)) {
              this._cache.set(token, instance);
            }
            if (!wantPromise && provider.isPromise) {
              resolvingMsg = constructResolvingMessage(resolving);
              throw new Error(("Cannot instantiate " + toString(token) + " synchronously. It is provided as a promise!" + resolvingMsg));
            }
            if (wantPromise && !provider.isPromise) {
              instance = Promise.resolve(instance);
            }
            resolving.pop();
            return instance;
          },
          getPromise: function(token) {
            return this.get(token, [], true);
          },
          createChild: function() {
            var modules = arguments[0] !== (void 0) ? arguments[0] : [];
            var forceNewInstancesOf = arguments[1] !== (void 0) ? arguments[1] : [];
            var forcedProviders = new Map();
            forceNewInstancesOf.push(TransientScopeAnnotation);
            for (var $__2 = forceNewInstancesOf[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__3 = void 0; !($__3 = $__2.next()).done; ) {
              var annotation = $__3.value;
              {
                this._collectProvidersWithAnnotation(annotation, forcedProviders);
              }
            }
            return new Injector(modules, this, forcedProviders, forceNewInstancesOf);
          }
        }, {});
      }());
      $__export("Injector", Injector);
    }
  };
});



System.register("github:jspm/nodelibs-process@0.1.1/index", ["npm:process@0.10.1"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = System._nodeRequire ? process : require("npm:process@0.10.1");
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/RenderNode", ["npm:famous@0.3.5/core/Entity", "npm:famous@0.3.5/core/SpecParser"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Entity = require("npm:famous@0.3.5/core/Entity");
  var SpecParser = require("npm:famous@0.3.5/core/SpecParser");
  function RenderNode(object) {
    this._object = null;
    this._child = null;
    this._hasMultipleChildren = false;
    this._isRenderable = false;
    this._isModifier = false;
    this._resultCache = {};
    this._prevResults = {};
    this._childResult = null;
    if (object)
      this.set(object);
  }
  RenderNode.prototype.add = function add(child) {
    var childNode = child instanceof RenderNode ? child : new RenderNode(child);
    if (this._child instanceof Array)
      this._child.push(childNode);
    else if (this._child) {
      this._child = [this._child, childNode];
      this._hasMultipleChildren = true;
      this._childResult = [];
    } else
      this._child = childNode;
    return childNode;
  };
  RenderNode.prototype.get = function get() {
    return this._object || (this._hasMultipleChildren ? null : this._child ? this._child.get() : null);
  };
  RenderNode.prototype.set = function set(child) {
    this._childResult = null;
    this._hasMultipleChildren = false;
    this._isRenderable = child.render ? true : false;
    this._isModifier = child.modify ? true : false;
    this._object = child;
    this._child = null;
    if (child instanceof RenderNode)
      return child;
    else
      return this;
  };
  RenderNode.prototype.getSize = function getSize() {
    var result = null;
    var target = this.get();
    if (target && target.getSize)
      result = target.getSize();
    if (!result && this._child && this._child.getSize)
      result = this._child.getSize();
    return result;
  };
  function _applyCommit(spec, context, cacheStorage) {
    var result = SpecParser.parse(spec, context);
    var keys = Object.keys(result);
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var childNode = Entity.get(id);
      var commitParams = result[id];
      commitParams.allocator = context.allocator;
      var commitResult = childNode.commit(commitParams);
      if (commitResult)
        _applyCommit(commitResult, context, cacheStorage);
      else
        cacheStorage[id] = commitParams;
    }
  }
  RenderNode.prototype.commit = function commit(context) {
    var prevKeys = Object.keys(this._prevResults);
    for (var i = 0; i < prevKeys.length; i++) {
      var id = prevKeys[i];
      if (this._resultCache[id] === undefined) {
        var object = Entity.get(id);
        if (object.cleanup)
          object.cleanup(context.allocator);
      }
    }
    this._prevResults = this._resultCache;
    this._resultCache = {};
    _applyCommit(this.render(), context, this._resultCache);
  };
  RenderNode.prototype.render = function render() {
    if (this._isRenderable)
      return this._object.render();
    var result = null;
    if (this._hasMultipleChildren) {
      result = this._childResult;
      var children = this._child;
      for (var i = 0; i < children.length; i++) {
        result[i] = children[i].render();
      }
    } else if (this._child)
      result = this._child.render();
    return this._isModifier ? this._object.modify(result) : result;
  };
  module.exports = RenderNode;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/transitions/Transitionable", ["npm:famous@0.3.5/transitions/MultipleTransition", "npm:famous@0.3.5/transitions/TweenTransition"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var MultipleTransition = require("npm:famous@0.3.5/transitions/MultipleTransition");
  var TweenTransition = require("npm:famous@0.3.5/transitions/TweenTransition");
  function Transitionable(start) {
    this.currentAction = null;
    this.actionQueue = [];
    this.callbackQueue = [];
    this.state = 0;
    this.velocity = undefined;
    this._callback = undefined;
    this._engineInstance = null;
    this._currentMethod = null;
    this.set(start);
  }
  var transitionMethods = {};
  Transitionable.register = function register(methods) {
    var success = true;
    for (var method in methods) {
      if (!Transitionable.registerMethod(method, methods[method]))
        success = false;
    }
    return success;
  };
  Transitionable.registerMethod = function registerMethod(name, engineClass) {
    if (!(name in transitionMethods)) {
      transitionMethods[name] = engineClass;
      return true;
    } else
      return false;
  };
  Transitionable.unregisterMethod = function unregisterMethod(name) {
    if (name in transitionMethods) {
      delete transitionMethods[name];
      return true;
    } else
      return false;
  };
  function _loadNext() {
    if (this._callback) {
      var callback = this._callback;
      this._callback = undefined;
      callback();
    }
    if (this.actionQueue.length <= 0) {
      this.set(this.get());
      return ;
    }
    this.currentAction = this.actionQueue.shift();
    this._callback = this.callbackQueue.shift();
    var method = null;
    var endValue = this.currentAction[0];
    var transition = this.currentAction[1];
    if (transition instanceof Object && transition.method) {
      method = transition.method;
      if (typeof method === 'string')
        method = transitionMethods[method];
    } else {
      method = TweenTransition;
    }
    if (this._currentMethod !== method) {
      if (!(endValue instanceof Object) || method.SUPPORTS_MULTIPLE === true || endValue.length <= method.SUPPORTS_MULTIPLE) {
        this._engineInstance = new method();
      } else {
        this._engineInstance = new MultipleTransition(method);
      }
      this._currentMethod = method;
    }
    this._engineInstance.reset(this.state, this.velocity);
    if (this.velocity !== undefined)
      transition.velocity = this.velocity;
    this._engineInstance.set(endValue, transition, _loadNext.bind(this));
  }
  Transitionable.prototype.set = function set(endState, transition, callback) {
    if (!transition) {
      this.reset(endState);
      if (callback)
        callback();
      return this;
    }
    var action = [endState, transition];
    this.actionQueue.push(action);
    this.callbackQueue.push(callback);
    if (!this.currentAction)
      _loadNext.call(this);
    return this;
  };
  Transitionable.prototype.reset = function reset(startState, startVelocity) {
    this._currentMethod = null;
    this._engineInstance = null;
    this._callback = undefined;
    this.state = startState;
    this.velocity = startVelocity;
    this.currentAction = null;
    this.actionQueue = [];
    this.callbackQueue = [];
  };
  Transitionable.prototype.delay = function delay(duration, callback) {
    var endValue;
    if (this.actionQueue.length)
      endValue = this.actionQueue[this.actionQueue.length - 1][0];
    else if (this.currentAction)
      endValue = this.currentAction[0];
    else
      endValue = this.get();
    return this.set(endValue, {
      duration: duration,
      curve: function() {
        return 0;
      }
    }, callback);
  };
  Transitionable.prototype.get = function get(timestamp) {
    if (this._engineInstance) {
      if (this._engineInstance.getVelocity)
        this.velocity = this._engineInstance.getVelocity();
      this.state = this._engineInstance.get(timestamp);
    }
    return this.state;
  };
  Transitionable.prototype.isActive = function isActive() {
    return !!this.currentAction;
  };
  Transitionable.prototype.halt = function halt() {
    return this.set(this.get());
  };
  module.exports = Transitionable;
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/Views/RenderController", ["npm:famous@0.3.5/core/Modifier", "npm:famous@0.3.5/core/RenderNode", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/transitions/Transitionable", "npm:famous@0.3.5/core/View"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Modifier = require("npm:famous@0.3.5/core/Modifier");
  var RenderNode = require("npm:famous@0.3.5/core/RenderNode");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
  var View = require("npm:famous@0.3.5/core/View");
  function RenderController(options) {
    View.apply(this, arguments);
    this._showing = -1;
    this._outgoingRenderables = [];
    this._nextRenderable = null;
    this._renderables = [];
    this._nodes = [];
    this._modifiers = [];
    this._states = [];
    this.inTransformMap = RenderController.DefaultMap.transform;
    this.inOpacityMap = RenderController.DefaultMap.opacity;
    this.inOriginMap = RenderController.DefaultMap.origin;
    this.inAlignMap = RenderController.DefaultMap.align;
    this.outTransformMap = RenderController.DefaultMap.transform;
    this.outOpacityMap = RenderController.DefaultMap.opacity;
    this.outOriginMap = RenderController.DefaultMap.origin;
    this.outAlignMap = RenderController.DefaultMap.align;
    this._output = [];
  }
  RenderController.prototype = Object.create(View.prototype);
  RenderController.prototype.constructor = RenderController;
  RenderController.DEFAULT_OPTIONS = {
    inTransition: true,
    outTransition: true,
    overlap: true
  };
  RenderController.DefaultMap = {
    transform: function() {
      return Transform.identity;
    },
    opacity: function(progress) {
      return progress;
    },
    origin: null,
    align: null
  };
  function _mappedState(map, state) {
    return map(state.get());
  }
  RenderController.prototype.inTransformFrom = function inTransformFrom(transform) {
    if (transform instanceof Function)
      this.inTransformMap = transform;
    else if (transform && transform.get)
      this.inTransformMap = transform.get.bind(transform);
    else
      throw new Error('inTransformFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.inOpacityFrom = function inOpacityFrom(opacity) {
    if (opacity instanceof Function)
      this.inOpacityMap = opacity;
    else if (opacity && opacity.get)
      this.inOpacityMap = opacity.get.bind(opacity);
    else
      throw new Error('inOpacityFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.inOriginFrom = function inOriginFrom(origin) {
    if (origin instanceof Function)
      this.inOriginMap = origin;
    else if (origin && origin.get)
      this.inOriginMap = origin.get.bind(origin);
    else
      throw new Error('inOriginFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.inAlignFrom = function inAlignFrom(align) {
    if (align instanceof Function)
      this.inAlignMap = align;
    else if (align && align.get)
      this.inAlignMap = align.get.bind(align);
    else
      throw new Error('inAlignFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.outTransformFrom = function outTransformFrom(transform) {
    if (transform instanceof Function)
      this.outTransformMap = transform;
    else if (transform && transform.get)
      this.outTransformMap = transform.get.bind(transform);
    else
      throw new Error('outTransformFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.outOpacityFrom = function outOpacityFrom(opacity) {
    if (opacity instanceof Function)
      this.outOpacityMap = opacity;
    else if (opacity && opacity.get)
      this.outOpacityMap = opacity.get.bind(opacity);
    else
      throw new Error('outOpacityFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.outOriginFrom = function outOriginFrom(origin) {
    if (origin instanceof Function)
      this.outOriginMap = origin;
    else if (origin && origin.get)
      this.outOriginMap = origin.get.bind(origin);
    else
      throw new Error('outOriginFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.outAlignFrom = function outAlignFrom(align) {
    if (align instanceof Function)
      this.outAlignMap = align;
    else if (align && align.get)
      this.outAlignMap = align.get.bind(align);
    else
      throw new Error('outAlignFrom takes only function or getter object');
    return this;
  };
  RenderController.prototype.show = function show(renderable, transition, callback) {
    if (!renderable) {
      return this.hide(callback);
    }
    if (transition instanceof Function) {
      callback = transition;
      transition = null;
    }
    if (this._showing >= 0) {
      if (this.options.overlap)
        this.hide();
      else {
        if (this._nextRenderable) {
          this._nextRenderable = renderable;
        } else {
          this._nextRenderable = renderable;
          this.hide(function() {
            if (this._nextRenderable === renderable)
              this.show(this._nextRenderable, callback);
            this._nextRenderable = null;
          });
        }
        return undefined;
      }
    }
    var state = null;
    var renderableIndex = this._renderables.indexOf(renderable);
    if (renderableIndex >= 0) {
      this._showing = renderableIndex;
      state = this._states[renderableIndex];
      state.halt();
      var outgoingIndex = this._outgoingRenderables.indexOf(renderable);
      if (outgoingIndex >= 0)
        this._outgoingRenderables.splice(outgoingIndex, 1);
    } else {
      state = new Transitionable(0);
      var modifier = new Modifier({
        transform: this.inTransformMap ? _mappedState.bind(this, this.inTransformMap, state) : null,
        opacity: this.inOpacityMap ? _mappedState.bind(this, this.inOpacityMap, state) : null,
        origin: this.inOriginMap ? _mappedState.bind(this, this.inOriginMap, state) : null,
        align: this.inAlignMap ? _mappedState.bind(this, this.inAlignMap, state) : null
      });
      var node = new RenderNode();
      node.add(modifier).add(renderable);
      this._showing = this._nodes.length;
      this._nodes.push(node);
      this._modifiers.push(modifier);
      this._states.push(state);
      this._renderables.push(renderable);
    }
    if (!transition)
      transition = this.options.inTransition;
    state.set(1, transition, callback);
  };
  RenderController.prototype.hide = function hide(transition, callback) {
    if (this._showing < 0)
      return ;
    var index = this._showing;
    this._showing = -1;
    if (transition instanceof Function) {
      callback = transition;
      transition = undefined;
    }
    var node = this._nodes[index];
    var modifier = this._modifiers[index];
    var state = this._states[index];
    var renderable = this._renderables[index];
    modifier.transformFrom(this.outTransformMap ? _mappedState.bind(this, this.outTransformMap, state) : null);
    modifier.opacityFrom(this.outOpacityMap ? _mappedState.bind(this, this.outOpacityMap, state) : null);
    modifier.originFrom(this.outOriginMap ? _mappedState.bind(this, this.outOriginMap, state) : null);
    modifier.alignFrom(this.outAlignMap ? _mappedState.bind(this, this.outAlignMap, state) : null);
    if (this._outgoingRenderables.indexOf(renderable) < 0)
      this._outgoingRenderables.push(renderable);
    if (!transition)
      transition = this.options.outTransition;
    state.halt();
    state.set(0, transition, function(node, modifier, state, renderable) {
      if (this._outgoingRenderables.indexOf(renderable) >= 0) {
        var index = this._nodes.indexOf(node);
        this._nodes.splice(index, 1);
        this._modifiers.splice(index, 1);
        this._states.splice(index, 1);
        this._renderables.splice(index, 1);
        this._outgoingRenderables.splice(this._outgoingRenderables.indexOf(renderable), 1);
        if (this._showing >= index)
          this._showing--;
      }
      if (callback)
        callback.call(this);
    }.bind(this, node, modifier, state, renderable));
  };
  RenderController.prototype.render = function render() {
    var result = this._output;
    if (result.length > this._nodes.length)
      result.splice(this._nodes.length);
    for (var i = 0; i < this._nodes.length; i++) {
      result[i] = this._nodes[i].render();
    }
    return result;
  };
  module.exports = RenderController;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/FlowLayoutNode", ["npm:famous@0.3.5/core/OptionsManager", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/math/Vector", "npm:famous@0.3.5/physics/bodies/Particle", "npm:famous@0.3.5/physics/forces/Spring", "npm:famous@0.3.5/physics/PhysicsEngine", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode", "npm:famous@0.3.5/transitions/Transitionable"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
    var Transform = require("npm:famous@0.3.5/core/Transform");
    var Vector = require("npm:famous@0.3.5/math/Vector");
    var Particle = require("npm:famous@0.3.5/physics/bodies/Particle");
    var Spring = require("npm:famous@0.3.5/physics/forces/Spring");
    var PhysicsEngine = require("npm:famous@0.3.5/physics/PhysicsEngine");
    var LayoutNode = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode");
    var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
    function FlowLayoutNode(renderNode, spec) {
      LayoutNode.apply(this, arguments);
      if (!this.options) {
        this.options = Object.create(this.constructor.DEFAULT_OPTIONS);
        this._optionsManager = new OptionsManager(this.options);
      }
      if (!this._pe) {
        this._pe = new PhysicsEngine();
        this._pe.sleep();
      }
      if (!this._properties) {
        this._properties = {};
      } else {
        for (var propName in this._properties) {
          this._properties[propName].init = false;
        }
      }
      if (!this._lockTransitionable) {
        this._lockTransitionable = new Transitionable(1);
      } else {
        this._lockTransitionable.halt();
        this._lockTransitionable.reset(1);
      }
      this._specModified = true;
      this._initial = true;
      this._spec.endState = {};
      if (spec) {
        this.setSpec(spec);
      }
    }
    FlowLayoutNode.prototype = Object.create(LayoutNode.prototype);
    FlowLayoutNode.prototype.constructor = FlowLayoutNode;
    FlowLayoutNode.DEFAULT_OPTIONS = {
      spring: {
        dampingRatio: 0.8,
        period: 300
      },
      properties: {
        opacity: true,
        align: true,
        origin: true,
        size: true,
        translate: true,
        skew: true,
        rotate: true,
        scale: true
      },
      particleRounding: 0.001
    };
    var DEFAULT = {
      opacity: 1,
      opacity2D: [1, 0],
      size: [0, 0],
      origin: [0, 0],
      align: [0, 0],
      scale: [1, 1, 1],
      translate: [0, 0, 0],
      rotate: [0, 0, 0],
      skew: [0, 0, 0]
    };
    FlowLayoutNode.prototype.setOptions = function(options) {
      this._optionsManager.setOptions(options);
      var wasSleeping = this._pe.isSleeping();
      for (var propName in this._properties) {
        var prop = this._properties[propName];
        if (options.spring && prop.force) {
          prop.force.setOptions(this.options.spring);
        }
        if (options.properties && (options.properties[propName] !== undefined)) {
          if (this.options.properties[propName].length) {
            prop.enabled = this.options.properties[propName];
          } else {
            prop.enabled = [this.options.properties[propName], this.options.properties[propName], this.options.properties[propName]];
          }
        }
      }
      if (wasSleeping) {
        this._pe.sleep();
      }
      return this;
    };
    FlowLayoutNode.prototype.setSpec = function(spec) {
      var set;
      if (spec.transform) {
        set = Transform.interpret(spec.transform);
      }
      if (!set) {
        set = {};
      }
      set.opacity = spec.opacity;
      set.size = spec.size;
      set.align = spec.align;
      set.origin = spec.origin;
      var oldRemoving = this._removing;
      var oldInvalidated = this._invalidated;
      this.set(set);
      this._removing = oldRemoving;
      this._invalidated = oldInvalidated;
    };
    FlowLayoutNode.prototype.reset = function() {
      if (this._invalidated) {
        for (var propName in this._properties) {
          this._properties[propName].invalidated = false;
        }
        this._invalidated = false;
      }
      this.trueSizeRequested = false;
      this.usesTrueSize = false;
    };
    FlowLayoutNode.prototype.remove = function(removeSpec) {
      this._removing = true;
      if (removeSpec) {
        this.setSpec(removeSpec);
      } else {
        this._pe.sleep();
        this._specModified = false;
      }
      this._invalidated = false;
    };
    FlowLayoutNode.prototype.releaseLock = function(enable) {
      this._lockTransitionable.halt();
      this._lockTransitionable.reset(0);
      if (enable) {
        this._lockTransitionable.set(1, {duration: this.options.spring.period || 1000});
      }
    };
    function _getRoundedValue3D(prop, def, precision, lockValue) {
      if (!prop || !prop.init) {
        return def;
      }
      return [prop.enabled[0] ? (Math.round((prop.curState.x + ((prop.endState.x - prop.curState.x) * lockValue)) / precision) * precision) : prop.endState.x, prop.enabled[1] ? (Math.round((prop.curState.y + ((prop.endState.y - prop.curState.y) * lockValue)) / precision) * precision) : prop.endState.y, prop.enabled[2] ? (Math.round((prop.curState.z + ((prop.endState.z - prop.curState.z) * lockValue)) / precision) * precision) : prop.endState.z];
    }
    FlowLayoutNode.prototype.getSpec = function() {
      var endStateReached = this._pe.isSleeping();
      if (!this._specModified && endStateReached) {
        this._spec.removed = !this._invalidated;
        return this._spec;
      }
      this._initial = false;
      this._specModified = !endStateReached;
      this._spec.removed = false;
      if (!endStateReached) {
        this._pe.step();
      }
      var spec = this._spec;
      var precision = this.options.particleRounding;
      var lockValue = this._lockTransitionable.get();
      var prop = this._properties.opacity;
      if (prop && prop.init) {
        spec.opacity = prop.enabled[0] ? (Math.round(Math.max(0, Math.min(1, prop.curState.x)) / precision) * precision) : prop.endState.x;
        spec.endState.opacity = prop.endState.x;
      } else {
        spec.opacity = undefined;
        spec.endState.opacity = undefined;
      }
      prop = this._properties.size;
      if (prop && prop.init) {
        spec.size = spec.size || [0, 0];
        spec.size[0] = prop.enabled[0] ? (Math.round((prop.curState.x + ((prop.endState.x - prop.curState.x) * lockValue)) / 0.1) * 0.1) : prop.endState.x;
        spec.size[1] = prop.enabled[1] ? (Math.round((prop.curState.y + ((prop.endState.y - prop.curState.y) * lockValue)) / 0.1) * 0.1) : prop.endState.y;
        spec.endState.size = spec.endState.size || [0, 0];
        spec.endState.size[0] = prop.endState.x;
        spec.endState.size[1] = prop.endState.y;
      } else {
        spec.size = undefined;
        spec.endState.size = undefined;
      }
      prop = this._properties.align;
      if (prop && prop.init) {
        spec.align = spec.align || [0, 0];
        spec.align[0] = prop.enabled[0] ? (Math.round((prop.curState.x + ((prop.endState.x - prop.curState.x) * lockValue)) / 0.1) * 0.1) : prop.endState.x;
        spec.align[1] = prop.enabled[1] ? (Math.round((prop.curState.y + ((prop.endState.y - prop.curState.y) * lockValue)) / 0.1) * 0.1) : prop.endState.y;
        spec.endState.align = spec.endState.align || [0, 0];
        spec.endState.align[0] = prop.endState.x;
        spec.endState.align[1] = prop.endState.y;
      } else {
        spec.align = undefined;
        spec.endState.align = undefined;
      }
      prop = this._properties.origin;
      if (prop && prop.init) {
        spec.origin = spec.origin || [0, 0];
        spec.origin[0] = prop.enabled[0] ? (Math.round((prop.curState.x + ((prop.endState.x - prop.curState.x) * lockValue)) / 0.1) * 0.1) : prop.endState.x;
        spec.origin[1] = prop.enabled[1] ? (Math.round((prop.curState.y + ((prop.endState.y - prop.curState.y) * lockValue)) / 0.1) * 0.1) : prop.endState.y;
        spec.endState.origin = spec.endState.origin || [0, 0];
        spec.endState.origin[0] = prop.endState.x;
        spec.endState.origin[1] = prop.endState.y;
      } else {
        spec.origin = undefined;
        spec.endState.origin = undefined;
      }
      var translate = this._properties.translate;
      var translateX;
      var translateY;
      var translateZ;
      if (translate && translate.init) {
        translateX = translate.enabled[0] ? (Math.round((translate.curState.x + ((translate.endState.x - translate.curState.x) * lockValue)) / precision) * precision) : translate.endState.x;
        translateY = translate.enabled[1] ? (Math.round((translate.curState.y + ((translate.endState.y - translate.curState.y) * lockValue)) / precision) * precision) : translate.endState.y;
        translateZ = translate.enabled[2] ? (Math.round((translate.curState.z + ((translate.endState.z - translate.curState.z) * lockValue)) / precision) * precision) : translate.endState.z;
      } else {
        translateX = 0;
        translateY = 0;
        translateZ = 0;
      }
      var scale = this._properties.scale;
      var skew = this._properties.skew;
      var rotate = this._properties.rotate;
      if (scale || skew || rotate) {
        spec.transform = Transform.build({
          translate: [translateX, translateY, translateZ],
          skew: _getRoundedValue3D.call(this, skew, DEFAULT.skew, this.options.particleRounding, lockValue),
          scale: _getRoundedValue3D.call(this, scale, DEFAULT.scale, this.options.particleRounding, lockValue),
          rotate: _getRoundedValue3D.call(this, rotate, DEFAULT.rotate, this.options.particleRounding, lockValue)
        });
        spec.endState.transform = Transform.build({
          translate: translate ? [translate.endState.x, translate.endState.y, translate.endState.z] : DEFAULT.translate,
          scale: scale ? [scale.endState.x, scale.endState.y, scale.endState.z] : DEFAULT.scale,
          skew: skew ? [skew.endState.x, skew.endState.y, skew.endState.z] : DEFAULT.skew,
          rotate: rotate ? [rotate.endState.x, rotate.endState.y, rotate.endState.z] : DEFAULT.rotate
        });
      } else if (translate) {
        if (!spec.transform) {
          spec.transform = Transform.translate(translateX, translateY, translateZ);
        } else {
          spec.transform[12] = translateX;
          spec.transform[13] = translateY;
          spec.transform[14] = translateZ;
        }
        if (!spec.endState.transform) {
          spec.endState.transform = Transform.translate(translate.endState.x, translate.endState.y, translate.endState.z);
        } else {
          spec.endState.transform[12] = translate.endState.x;
          spec.endState.transform[13] = translate.endState.y;
          spec.endState.transform[14] = translate.endState.z;
        }
      } else {
        spec.transform = undefined;
        spec.endState.transform = undefined;
      }
      return this._spec;
    };
    function _setPropertyValue(prop, propName, endState, defaultValue, immediate, isTranslate) {
      prop = prop || this._properties[propName];
      if (prop && prop.init) {
        prop.invalidated = true;
        var value = defaultValue;
        if (endState !== undefined) {
          value = endState;
        } else if (this._removing) {
          value = prop.particle.getPosition();
        }
        prop.endState.x = value[0];
        prop.endState.y = (value.length > 1) ? value[1] : 0;
        prop.endState.z = (value.length > 2) ? value[2] : 0;
        if (immediate) {
          prop.curState.x = prop.endState.x;
          prop.curState.y = prop.endState.y;
          prop.curState.z = prop.endState.z;
          prop.velocity.x = 0;
          prop.velocity.y = 0;
          prop.velocity.z = 0;
        } else if ((prop.endState.x !== prop.curState.x) || (prop.endState.y !== prop.curState.y) || (prop.endState.z !== prop.curState.z)) {
          this._pe.wake();
        }
        return ;
      } else {
        var wasSleeping = this._pe.isSleeping();
        if (!prop) {
          prop = {
            particle: new Particle({position: (this._initial || immediate) ? endState : defaultValue}),
            endState: new Vector(endState)
          };
          prop.curState = prop.particle.position;
          prop.velocity = prop.particle.velocity;
          prop.force = new Spring(this.options.spring);
          prop.force.setOptions({anchor: prop.endState});
          this._pe.addBody(prop.particle);
          prop.forceId = this._pe.attach(prop.force, prop.particle);
          this._properties[propName] = prop;
        } else {
          prop.particle.setPosition((this._initial || immediate) ? endState : defaultValue);
          prop.endState.set(endState);
        }
        if (!this._initial && !immediate) {
          this._pe.wake();
        } else if (wasSleeping) {
          this._pe.sleep();
        }
        if (this.options.properties[propName] && this.options.properties[propName].length) {
          prop.enabled = this.options.properties[propName];
        } else {
          prop.enabled = [this.options.properties[propName], this.options.properties[propName], this.options.properties[propName]];
        }
        prop.init = true;
        prop.invalidated = true;
      }
    }
    function _getIfNE2D(a1, a2) {
      return ((a1[0] === a2[0]) && (a1[1] === a2[1])) ? undefined : a1;
    }
    function _getIfNE3D(a1, a2) {
      return ((a1[0] === a2[0]) && (a1[1] === a2[1]) && (a1[2] === a2[2])) ? undefined : a1;
    }
    FlowLayoutNode.prototype.set = function(set, defaultSize) {
      if (defaultSize) {
        this._removing = false;
      }
      this._invalidated = true;
      this.scrollLength = set.scrollLength;
      this._specModified = true;
      var prop = this._properties.opacity;
      var value = (set.opacity === DEFAULT.opacity) ? undefined : set.opacity;
      if ((value !== undefined) || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'opacity', (value === undefined) ? undefined : [value, 0], DEFAULT.opacity2D);
      }
      prop = this._properties.align;
      value = set.align ? _getIfNE2D(set.align, DEFAULT.align) : undefined;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'align', value, DEFAULT.align);
      }
      prop = this._properties.origin;
      value = set.origin ? _getIfNE2D(set.origin, DEFAULT.origin) : undefined;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'origin', value, DEFAULT.origin);
      }
      prop = this._properties.size;
      value = set.size || defaultSize;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'size', value, defaultSize, this.usesTrueSize);
      }
      prop = this._properties.translate;
      value = set.translate;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'translate', value, DEFAULT.translate, undefined, true);
      }
      prop = this._properties.scale;
      value = set.scale ? _getIfNE3D(set.scale, DEFAULT.scale) : undefined;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'scale', value, DEFAULT.scale);
      }
      prop = this._properties.rotate;
      value = set.rotate ? _getIfNE3D(set.rotate, DEFAULT.rotate) : undefined;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'rotate', value, DEFAULT.rotate);
      }
      prop = this._properties.skew;
      value = set.skew ? _getIfNE3D(set.skew, DEFAULT.skew) : undefined;
      if (value || (prop && prop.init)) {
        _setPropertyValue.call(this, prop, 'skew', value, DEFAULT.skew);
      }
    };
    module.exports = FlowLayoutNode;
  }).call(__exports, __require, __exports, __module);
});


})();
(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/FlexScrollView", ["github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility", "github:ijzerenhein/famous-flex@0.3.1/src/ScrollController", "github:ijzerenhein/famous-flex@0.3.1/src/layouts/ListLayout"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    var ScrollController = require("github:ijzerenhein/famous-flex@0.3.1/src/ScrollController");
    var ListLayout = require("github:ijzerenhein/famous-flex@0.3.1/src/layouts/ListLayout");
    var PullToRefreshState = {
      HIDDEN: 0,
      PULLING: 1,
      ACTIVE: 2,
      COMPLETED: 3,
      HIDDING: 4
    };
    function FlexScrollView(options) {
      ScrollController.call(this, LayoutUtility.combineOptions(FlexScrollView.DEFAULT_OPTIONS, options));
      this._thisScrollViewDelta = 0;
      this._leadingScrollViewDelta = 0;
      this._trailingScrollViewDelta = 0;
    }
    FlexScrollView.prototype = Object.create(ScrollController.prototype);
    FlexScrollView.prototype.constructor = FlexScrollView;
    FlexScrollView.PullToRefreshState = PullToRefreshState;
    FlexScrollView.Bounds = ScrollController.Bounds;
    FlexScrollView.PaginationMode = ScrollController.PaginationMode;
    FlexScrollView.DEFAULT_OPTIONS = {
      layout: ListLayout,
      direction: undefined,
      paginated: false,
      alignment: 0,
      flow: false,
      mouseMove: false,
      useContainer: false,
      visibleItemThresshold: 0.5,
      pullToRefreshHeader: undefined,
      pullToRefreshFooter: undefined,
      leadingScrollView: undefined,
      trailingScrollView: undefined
    };
    FlexScrollView.prototype.setOptions = function(options) {
      ScrollController.prototype.setOptions.call(this, options);
      if (options.pullToRefreshHeader || options.pullToRefreshFooter || this._pullToRefresh) {
        if (options.pullToRefreshHeader) {
          this._pullToRefresh = this._pullToRefresh || [undefined, undefined];
          if (!this._pullToRefresh[0]) {
            this._pullToRefresh[0] = {
              state: PullToRefreshState.HIDDEN,
              prevState: PullToRefreshState.HIDDEN,
              footer: false
            };
          }
          this._pullToRefresh[0].node = options.pullToRefreshHeader;
        } else if (!this.options.pullToRefreshHeader && this._pullToRefresh) {
          this._pullToRefresh[0] = undefined;
        }
        if (options.pullToRefreshFooter) {
          this._pullToRefresh = this._pullToRefresh || [undefined, undefined];
          if (!this._pullToRefresh[1]) {
            this._pullToRefresh[1] = {
              state: PullToRefreshState.HIDDEN,
              prevState: PullToRefreshState.HIDDEN,
              footer: true
            };
          }
          this._pullToRefresh[1].node = options.pullToRefreshFooter;
        } else if (!this.options.pullToRefreshFooter && this._pullToRefresh) {
          this._pullToRefresh[1] = undefined;
        }
        if (this._pullToRefresh && !this._pullToRefresh[0] && !this._pullToRefresh[1]) {
          this._pullToRefresh = undefined;
        }
      }
      return this;
    };
    FlexScrollView.prototype.sequenceFrom = function(node) {
      return this.setDataSource(node);
    };
    FlexScrollView.prototype.getCurrentIndex = function() {
      var item = this.getFirstVisibleItem();
      return item ? item.viewSequence.getIndex() : -1;
    };
    FlexScrollView.prototype.goToPage = function(index, noAnimation) {
      var viewSequence = this._viewSequence;
      if (!viewSequence) {
        return this;
      }
      while (viewSequence.getIndex() < index) {
        viewSequence = viewSequence.getNext();
        if (!viewSequence) {
          return this;
        }
      }
      while (viewSequence.getIndex() > index) {
        viewSequence = viewSequence.getPrevious();
        if (!viewSequence) {
          return this;
        }
      }
      this.goToRenderNode(viewSequence.get(), noAnimation);
      return this;
    };
    FlexScrollView.prototype.getOffset = function() {
      return this._scrollOffsetCache;
    };
    FlexScrollView.prototype.getPosition = FlexScrollView.prototype.getOffset;
    FlexScrollView.prototype.getAbsolutePosition = function() {
      return -(this._scrollOffsetCache + this._scroll.groupStart);
    };
    function _setPullToRefreshState(pullToRefresh, state) {
      if (pullToRefresh.state !== state) {
        pullToRefresh.state = state;
        if (pullToRefresh.node && pullToRefresh.node.setPullToRefreshStatus) {
          pullToRefresh.node.setPullToRefreshStatus(state);
        }
      }
    }
    function _getPullToRefresh(footer) {
      return this._pullToRefresh ? this._pullToRefresh[footer ? 1 : 0] : undefined;
    }
    FlexScrollView.prototype._postLayout = function(size, scrollOffset) {
      if (!this._pullToRefresh) {
        return ;
      }
      if (this.options.alignment) {
        scrollOffset += size[this._direction];
      }
      var prevHeight;
      var nextHeight;
      var totalHeight;
      for (var i = 0; i < 2; i++) {
        var pullToRefresh = this._pullToRefresh[i];
        if (pullToRefresh) {
          var length = pullToRefresh.node.getSize()[this._direction];
          var pullLength = pullToRefresh.node.getPullToRefreshSize ? pullToRefresh.node.getPullToRefreshSize()[this._direction] : length;
          var offset;
          if (!pullToRefresh.footer) {
            prevHeight = this._calcScrollHeight(false);
            prevHeight = (prevHeight === undefined) ? -1 : prevHeight;
            offset = (prevHeight >= 0) ? (scrollOffset - prevHeight) : prevHeight;
            if (this.options.alignment) {
              nextHeight = this._calcScrollHeight(true);
              nextHeight = (nextHeight === undefined) ? -1 : nextHeight;
              totalHeight = ((prevHeight >= 0) && (nextHeight >= 0)) ? (prevHeight + nextHeight) : -1;
              if ((totalHeight >= 0) && (totalHeight < size[this._direction])) {
                offset = Math.round((scrollOffset - size[this._direction]) + nextHeight);
              }
            }
          } else {
            nextHeight = (nextHeight === undefined) ? nextHeight = this._calcScrollHeight(true) : nextHeight;
            nextHeight = (nextHeight === undefined) ? -1 : nextHeight;
            offset = (nextHeight >= 0) ? (scrollOffset + nextHeight) : (size[this._direction] + 1);
            if (!this.options.alignment) {
              prevHeight = (prevHeight === undefined) ? this._calcScrollHeight(false) : prevHeight;
              prevHeight = (prevHeight === undefined) ? -1 : prevHeight;
              totalHeight = ((prevHeight >= 0) && (nextHeight >= 0)) ? (prevHeight + nextHeight) : -1;
              if ((totalHeight >= 0) && (totalHeight < size[this._direction])) {
                offset = Math.round((scrollOffset - prevHeight) + size[this._direction]);
              }
            }
            offset = -(offset - size[this._direction]);
          }
          var visiblePerc = Math.max(Math.min(offset / pullLength, 1), 0);
          switch (pullToRefresh.state) {
            case PullToRefreshState.HIDDEN:
              if (this._scroll.scrollForceCount) {
                if (visiblePerc >= 1) {
                  _setPullToRefreshState(pullToRefresh, PullToRefreshState.ACTIVE);
                } else if (offset >= 0.2) {
                  _setPullToRefreshState(pullToRefresh, PullToRefreshState.PULLING);
                }
              }
              break;
            case PullToRefreshState.PULLING:
              if (this._scroll.scrollForceCount && (visiblePerc >= 1)) {
                _setPullToRefreshState(pullToRefresh, PullToRefreshState.ACTIVE);
              } else if (offset < 0.2) {
                _setPullToRefreshState(pullToRefresh, PullToRefreshState.HIDDEN);
              }
              break;
            case PullToRefreshState.ACTIVE:
              break;
            case PullToRefreshState.COMPLETED:
              if (!this._scroll.scrollForceCount) {
                if (offset >= 0.2) {
                  _setPullToRefreshState(pullToRefresh, PullToRefreshState.HIDDING);
                } else {
                  _setPullToRefreshState(pullToRefresh, PullToRefreshState.HIDDEN);
                }
              }
              break;
            case PullToRefreshState.HIDDING:
              if (offset < 0.2) {
                _setPullToRefreshState(pullToRefresh, PullToRefreshState.HIDDEN);
              }
              break;
          }
          if (pullToRefresh.state !== PullToRefreshState.HIDDEN) {
            var contextNode = {
              renderNode: pullToRefresh.node,
              prev: !pullToRefresh.footer,
              next: pullToRefresh.footer,
              index: !pullToRefresh.footer ? --this._nodes._contextState.prevGetIndex : ++this._nodes._contextState.nextGetIndex
            };
            var scrollLength;
            if (pullToRefresh.state === PullToRefreshState.ACTIVE) {
              scrollLength = length;
            } else if (this._scroll.scrollForceCount) {
              scrollLength = Math.min(offset, length);
            }
            var set = {
              size: [size[0], size[1]],
              translate: [0, 0, -1e-3],
              scrollLength: scrollLength
            };
            set.size[this._direction] = Math.max(Math.min(offset, pullLength), 0);
            set.translate[this._direction] = pullToRefresh.footer ? (size[this._direction] - length) : 0;
            this._nodes._context.set(contextNode, set);
          }
        }
      }
    };
    FlexScrollView.prototype.showPullToRefresh = function(footer) {
      var pullToRefresh = _getPullToRefresh.call(this, footer);
      if (pullToRefresh) {
        _setPullToRefreshState(pullToRefresh, PullToRefreshState.ACTIVE);
        this._scroll.scrollDirty = true;
      }
    };
    FlexScrollView.prototype.hidePullToRefresh = function(footer) {
      var pullToRefresh = _getPullToRefresh.call(this, footer);
      if (pullToRefresh && (pullToRefresh.state === PullToRefreshState.ACTIVE)) {
        _setPullToRefreshState(pullToRefresh, PullToRefreshState.COMPLETED);
        this._scroll.scrollDirty = true;
      }
      return this;
    };
    FlexScrollView.prototype.isPullToRefreshVisible = function(footer) {
      var pullToRefresh = _getPullToRefresh.call(this, footer);
      return pullToRefresh ? (pullToRefresh.state === PullToRefreshState.ACTIVE) : false;
    };
    FlexScrollView.prototype.applyScrollForce = function(delta) {
      var leadingScrollView = this.options.leadingScrollView;
      var trailingScrollView = this.options.trailingScrollView;
      if (!leadingScrollView && !trailingScrollView) {
        return ScrollController.prototype.applyScrollForce.call(this, delta);
      }
      var partialDelta;
      if (delta < 0) {
        if (leadingScrollView) {
          partialDelta = leadingScrollView.canScroll(delta);
          this._leadingScrollViewDelta += partialDelta;
          leadingScrollView.applyScrollForce(partialDelta);
          delta -= partialDelta;
        }
        if (trailingScrollView) {
          partialDelta = this.canScroll(delta);
          ScrollController.prototype.applyScrollForce.call(this, partialDelta);
          this._thisScrollViewDelta += partialDelta;
          delta -= partialDelta;
          trailingScrollView.applyScrollForce(delta);
          this._trailingScrollViewDelta += delta;
        } else {
          ScrollController.prototype.applyScrollForce.call(this, delta);
          this._thisScrollViewDelta += delta;
        }
      } else {
        if (trailingScrollView) {
          partialDelta = trailingScrollView.canScroll(delta);
          trailingScrollView.applyScrollForce(partialDelta);
          this._trailingScrollViewDelta += partialDelta;
          delta -= partialDelta;
        }
        if (leadingScrollView) {
          partialDelta = this.canScroll(delta);
          ScrollController.prototype.applyScrollForce.call(this, partialDelta);
          this._thisScrollViewDelta += partialDelta;
          delta -= partialDelta;
          leadingScrollView.applyScrollForce(delta);
          this._leadingScrollViewDelta += delta;
        } else {
          ScrollController.prototype.applyScrollForce.call(this, delta);
          this._thisScrollViewDelta += delta;
        }
      }
      return this;
    };
    FlexScrollView.prototype.updateScrollForce = function(prevDelta, newDelta) {
      var leadingScrollView = this.options.leadingScrollView;
      var trailingScrollView = this.options.trailingScrollView;
      if (!leadingScrollView && !trailingScrollView) {
        return ScrollController.prototype.updateScrollForce.call(this, prevDelta, newDelta);
      }
      var partialDelta;
      var delta = newDelta - prevDelta;
      if (delta < 0) {
        if (leadingScrollView) {
          partialDelta = leadingScrollView.canScroll(delta);
          leadingScrollView.updateScrollForce(this._leadingScrollViewDelta, this._leadingScrollViewDelta + partialDelta);
          this._leadingScrollViewDelta += partialDelta;
          delta -= partialDelta;
        }
        if (trailingScrollView && delta) {
          partialDelta = this.canScroll(delta);
          ScrollController.prototype.updateScrollForce.call(this, this._thisScrollViewDelta, this._thisScrollViewDelta + partialDelta);
          this._thisScrollViewDelta += partialDelta;
          delta -= partialDelta;
          this._trailingScrollViewDelta += delta;
          trailingScrollView.updateScrollForce(this._trailingScrollViewDelta, this._trailingScrollViewDelta + delta);
        } else if (delta) {
          ScrollController.prototype.updateScrollForce.call(this, this._thisScrollViewDelta, this._thisScrollViewDelta + delta);
          this._thisScrollViewDelta += delta;
        }
      } else {
        if (trailingScrollView) {
          partialDelta = trailingScrollView.canScroll(delta);
          trailingScrollView.updateScrollForce(this._trailingScrollViewDelta, this._trailingScrollViewDelta + partialDelta);
          this._trailingScrollViewDelta += partialDelta;
          delta -= partialDelta;
        }
        if (leadingScrollView) {
          partialDelta = this.canScroll(delta);
          ScrollController.prototype.updateScrollForce.call(this, this._thisScrollViewDelta, this._thisScrollViewDelta + partialDelta);
          this._thisScrollViewDelta += partialDelta;
          delta -= partialDelta;
          leadingScrollView.updateScrollForce(this._leadingScrollViewDelta, this._leadingScrollViewDelta + delta);
          this._leadingScrollViewDelta += delta;
        } else {
          ScrollController.prototype.updateScrollForce.call(this, this._thisScrollViewDelta, this._thisScrollViewDelta + delta);
          this._thisScrollViewDelta += delta;
        }
      }
      return this;
    };
    FlexScrollView.prototype.releaseScrollForce = function(delta, velocity) {
      var leadingScrollView = this.options.leadingScrollView;
      var trailingScrollView = this.options.trailingScrollView;
      if (!leadingScrollView && !trailingScrollView) {
        return ScrollController.prototype.releaseScrollForce.call(this, delta, velocity);
      }
      var partialDelta;
      if (delta < 0) {
        if (leadingScrollView) {
          partialDelta = Math.max(this._leadingScrollViewDelta, delta);
          this._leadingScrollViewDelta -= partialDelta;
          delta -= partialDelta;
          leadingScrollView.releaseScrollForce(this._leadingScrollViewDelta, delta ? 0 : velocity);
        }
        if (trailingScrollView) {
          partialDelta = Math.max(this._thisScrollViewDelta, delta);
          this._thisScrollViewDelta -= partialDelta;
          delta -= partialDelta;
          ScrollController.prototype.releaseScrollForce.call(this, this._thisScrollViewDelta, delta ? 0 : velocity);
          this._trailingScrollViewDelta -= delta;
          trailingScrollView.releaseScrollForce(this._trailingScrollViewDelta, delta ? velocity : 0);
        } else {
          this._thisScrollViewDelta -= delta;
          ScrollController.prototype.releaseScrollForce.call(this, this._thisScrollViewDelta, delta ? velocity : 0);
        }
      } else {
        if (trailingScrollView) {
          partialDelta = Math.min(this._trailingScrollViewDelta, delta);
          this._trailingScrollViewDelta -= partialDelta;
          delta -= partialDelta;
          trailingScrollView.releaseScrollForce(this._trailingScrollViewDelta, delta ? 0 : velocity);
        }
        if (leadingScrollView) {
          partialDelta = Math.min(this._thisScrollViewDelta, delta);
          this._thisScrollViewDelta -= partialDelta;
          delta -= partialDelta;
          ScrollController.prototype.releaseScrollForce.call(this, this._thisScrollViewDelta, delta ? 0 : velocity);
          this._leadingScrollViewDelta -= delta;
          leadingScrollView.releaseScrollForce(this._leadingScrollViewDelta, delta ? velocity : 0);
        } else {
          this._thisScrollViewDelta -= delta;
          ScrollController.prototype.updateScrollForce.call(this, this._thisScrollViewDelta, delta ? velocity : 0);
        }
      }
      return this;
    };
    FlexScrollView.prototype.commit = function(context) {
      var result = ScrollController.prototype.commit.call(this, context);
      if (this._pullToRefresh) {
        for (var i = 0; i < 2; i++) {
          var pullToRefresh = this._pullToRefresh[i];
          if (pullToRefresh) {
            if ((pullToRefresh.state === PullToRefreshState.ACTIVE) && (pullToRefresh.prevState !== PullToRefreshState.ACTIVE)) {
              this._eventOutput.emit('refresh', {
                target: this,
                footer: pullToRefresh.footer
              });
            }
            pullToRefresh.prevState = pullToRefresh.state;
          }
        }
      }
      return result;
    };
    module.exports = FlexScrollView;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("github:Bizboard/arva-ds@master/datasources/FirebaseDataSource", ["github:Bizboard/arva-ds@master/utils/objectHelper", "github:Bizboard/arva-ds@master/core/DataSource", "github:firebase/firebase-bower@2.2.4", "github:angular/di.js@master"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/arva-ds@master/datasources/FirebaseDataSource";
  var ObjectHelper,
      DataSource,
      Firebase,
      Provide,
      annotate,
      FirebaseDataSource;
  return {
    setters: [function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      DataSource = $__m.DataSource;
    }, function($__m) {
      Firebase = $__m.default;
    }, function($__m) {
      Provide = $__m.Provide;
      annotate = $__m.annotate;
    }],
    execute: function() {
      FirebaseDataSource = $__export("FirebaseDataSource", (function($__super) {
        var FirebaseDataSource = function FirebaseDataSource(path) {
          $traceurRuntime.superConstructor(FirebaseDataSource).call(this, path);
          this._onValueCallback = null;
          this._onAddCallback = null;
          this._onChangeCallback = null;
          this._onMoveCallback = null;
          this._onRemoveCallback = null;
          this._dataReference = new Firebase(path);
          ObjectHelper.bindAllMethods(this, this);
        };
        return ($traceurRuntime.createClass)(FirebaseDataSource, {
          get dataReference() {
            return this._dataReference;
          },
          set dataReference(value) {
            this._dataReference = value;
          },
          child: function(childName) {
            return new FirebaseDataSource(this._dataReference.child(childName).toString());
          },
          path: function() {
            return this._dataReference.toString();
          },
          key: function() {
            return this._dataReference.key();
          },
          set: function(newData) {
            return this._dataReference.set(newData);
          },
          remove: function() {
            return this._dataReference.remove();
          },
          push: function(newData) {
            return new FirebaseDataSource(this._dataReference.push(newData).toString());
          },
          setWithPriority: function(newData, priority) {
            return this._dataReference.setWithPriority(newData, priority);
          },
          setPriority: function(newPriority) {
            return this._dataReference.setPriority(newPriority);
          },
          setValueChangedCallback: function(callback) {
            this._onValueCallback = callback;
            this._dataReference.on('value', this._onValueCallback);
          },
          removeValueChangedCallback: function() {
            if (this._onValueCallback) {
              this._dataReference.off('value', this._onValueCallback);
              this._onValueCallback = null;
            }
          },
          setChildAddedCallback: function(callback) {
            var $__0 = this;
            this._onAddCallback = callback;
            this._dataReference.on('child_added', (function(newChildSnapshot, prevChildName) {
              $__0._onAddCallback(newChildSnapshot);
            }));
          },
          removeChildAddedCallback: function() {
            if (this._onAddCallback) {
              this._dataReference.off('child_added', this._onAddCallback);
              this._onAddCallback = null;
            }
          },
          setChildChangedCallback: function(callback) {
            var $__0 = this;
            this._onChangeCallback = callback;
            this._dataReference.on('child_changed', (function(newChildSnapshot, prevChildName) {
              $__0._onChangeCallback(newChildSnapshot);
            }));
          },
          removeChildChangedCallback: function() {
            if (this._onChangeCallback) {
              this._dataReference.off('child_added', this._onChangeCallback);
              this._onChangeCallback = null;
            }
          },
          setChildMovedCallback: function(callback) {
            var $__0 = this;
            this._onMoveCallback = callback;
            this._dataReference.on('child_moved', (function(newChildSnapshot, prevChildName) {
              $__0._onMoveCallback(newChildSnapshot);
            }));
          },
          removeChildMovedCallback: function() {
            if (this._onMoveCallback) {
              this._dataReference.off('child_moved', this._onMoveCallback);
              this._onMoveCallback = null;
            }
          },
          setChildRemovedCallback: function(callback) {
            this._onRemoveCallback = callback;
            this._dataReference.on('child_removed', this._onRemoveCallback);
          },
          removeChildRemovedCallback: function() {
            if (this._onRemoveCallback) {
              this._dataReference.off('child_removed', this._onRemoveCallback);
              this._onRemoveCallback = null;
            }
          }
        }, {}, $__super);
      }(DataSource)));
      annotate(FirebaseDataSource, new Provide(DataSource));
    }
  };
});



System.register("github:angular/di.js@master/index", ["github:angular/di.js@master/injector", "github:angular/di.js@master/annotations"], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master/index";
  return {
    setters: [function($__m) {
      $__export("Injector", $__m.Injector);
    }, function($__m) {
      $__export("annotate", $__m.annotate);
      $__export("Inject", $__m.Inject);
      $__export("InjectLazy", $__m.InjectLazy);
      $__export("InjectPromise", $__m.InjectPromise);
      $__export("Provide", $__m.Provide);
      $__export("ProvidePromise", $__m.ProvidePromise);
      $__export("SuperConstructor", $__m.SuperConstructor);
      $__export("TransientScope", $__m.TransientScope);
      $__export("ClassProvider", $__m.ClassProvider);
      $__export("FactoryProvider", $__m.FactoryProvider);
    }],
    execute: function() {}
  };
});



System.register("github:jspm/nodelibs-process@0.1.1", ["github:jspm/nodelibs-process@0.1.1/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("github:jspm/nodelibs-process@0.1.1/index");
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Context", ["npm:famous@0.3.5/core/RenderNode", "npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/ElementAllocator", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/transitions/Transitionable"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var RenderNode = require("npm:famous@0.3.5/core/RenderNode");
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  var ElementAllocator = require("npm:famous@0.3.5/core/ElementAllocator");
  var Transform = require("npm:famous@0.3.5/core/Transform");
  var Transitionable = require("npm:famous@0.3.5/transitions/Transitionable");
  var _zeroZero = [0, 0];
  var usePrefix = !('perspective' in document.documentElement.style);
  function _getElementSize() {
    var element = this.container;
    return [element.clientWidth, element.clientHeight];
  }
  var _setPerspective = usePrefix ? function(element, perspective) {
    element.style.webkitPerspective = perspective ? perspective.toFixed() + 'px' : '';
  } : function(element, perspective) {
    element.style.perspective = perspective ? perspective.toFixed() + 'px' : '';
  };
  function Context(container) {
    this.container = container;
    this._allocator = new ElementAllocator(container);
    this._node = new RenderNode();
    this._eventOutput = new EventHandler();
    this._size = _getElementSize.call(this);
    this._perspectiveState = new Transitionable(0);
    this._perspective = undefined;
    this._nodeContext = {
      allocator: this._allocator,
      transform: Transform.identity,
      opacity: 1,
      origin: _zeroZero,
      align: _zeroZero,
      size: this._size
    };
    this._eventOutput.on('resize', function() {
      this.setSize(_getElementSize.call(this));
    }.bind(this));
  }
  Context.prototype.getAllocator = function getAllocator() {
    return this._allocator;
  };
  Context.prototype.add = function add(obj) {
    return this._node.add(obj);
  };
  Context.prototype.migrate = function migrate(container) {
    if (container === this.container)
      return ;
    this.container = container;
    this._allocator.migrate(container);
  };
  Context.prototype.getSize = function getSize() {
    return this._size;
  };
  Context.prototype.setSize = function setSize(size) {
    if (!size)
      size = _getElementSize.call(this);
    this._size[0] = size[0];
    this._size[1] = size[1];
  };
  Context.prototype.update = function update(contextParameters) {
    if (contextParameters) {
      if (contextParameters.transform)
        this._nodeContext.transform = contextParameters.transform;
      if (contextParameters.opacity)
        this._nodeContext.opacity = contextParameters.opacity;
      if (contextParameters.origin)
        this._nodeContext.origin = contextParameters.origin;
      if (contextParameters.align)
        this._nodeContext.align = contextParameters.align;
      if (contextParameters.size)
        this._nodeContext.size = contextParameters.size;
    }
    var perspective = this._perspectiveState.get();
    if (perspective !== this._perspective) {
      _setPerspective(this.container, perspective);
      this._perspective = perspective;
    }
    this._node.commit(this._nodeContext);
  };
  Context.prototype.getPerspective = function getPerspective() {
    return this._perspectiveState.get();
  };
  Context.prototype.setPerspective = function setPerspective(perspective, transition, callback) {
    return this._perspectiveState.set(perspective, transition, callback);
  };
  Context.prototype.emit = function emit(type, event) {
    return this._eventOutput.emit(type, event);
  };
  Context.prototype.on = function on(type, handler) {
    return this._eventOutput.on(type, handler);
  };
  Context.prototype.removeListener = function removeListener(type, handler) {
    return this._eventOutput.removeListener(type, handler);
  };
  Context.prototype.pipe = function pipe(target) {
    return this._eventOutput.pipe(target);
  };
  Context.prototype.unpipe = function unpipe(target) {
    return this._eventOutput.unpipe(target);
  };
  module.exports = Context;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", ["npm:famous@0.3.5/utilities/Utility", "npm:famous@0.3.5/core/Entity", "npm:famous@0.3.5/core/ViewSequence", "npm:famous@0.3.5/core/OptionsManager", "npm:famous@0.3.5/core/EventHandler", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutNodeManager", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode", "github:ijzerenhein/famous-flex@0.3.1/src/FlowLayoutNode", "npm:famous@0.3.5/core/Transform", "github:ijzerenhein/famous-flex@0.3.1/src/helpers/LayoutDockHelper"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Utility = require("npm:famous@0.3.5/utilities/Utility");
    var Entity = require("npm:famous@0.3.5/core/Entity");
    var ViewSequence = require("npm:famous@0.3.5/core/ViewSequence");
    var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
    var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutUtility");
    var LayoutNodeManager = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNodeManager");
    var LayoutNode = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutNode");
    var FlowLayoutNode = require("github:ijzerenhein/famous-flex@0.3.1/src/FlowLayoutNode");
    var Transform = require("npm:famous@0.3.5/core/Transform");
    require("github:ijzerenhein/famous-flex@0.3.1/src/helpers/LayoutDockHelper");
    function LayoutController(options, nodeManager) {
      this.id = Entity.register(this);
      this._isDirty = true;
      this._contextSizeCache = [0, 0];
      this._commitOutput = {};
      this._cleanupRegistration = {
        commit: function() {
          return undefined;
        },
        cleanup: function(context) {
          this.cleanup(context);
        }.bind(this)
      };
      this._cleanupRegistration.target = Entity.register(this._cleanupRegistration);
      this._cleanupRegistration.render = function() {
        return this.target;
      }.bind(this._cleanupRegistration);
      this._eventInput = new EventHandler();
      EventHandler.setInputHandler(this, this._eventInput);
      this._eventOutput = new EventHandler();
      EventHandler.setOutputHandler(this, this._eventOutput);
      this._layout = {options: Object.create({})};
      this._layout.optionsManager = new OptionsManager(this._layout.options);
      this._layout.optionsManager.on('change', function() {
        this._isDirty = true;
      }.bind(this));
      this.options = Object.create(LayoutController.DEFAULT_OPTIONS);
      this._optionsManager = new OptionsManager(this.options);
      if (nodeManager) {
        this._nodes = nodeManager;
      } else if (options && options.flow) {
        this._nodes = new LayoutNodeManager(FlowLayoutNode, _initFlowLayoutNode.bind(this));
      } else {
        this._nodes = new LayoutNodeManager(LayoutNode);
      }
      this.setDirection(undefined);
      if (options) {
        this.setOptions(options);
      }
    }
    LayoutController.DEFAULT_OPTIONS = {
      flow: false,
      flowOptions: {
        reflowOnResize: true,
        properties: {
          opacity: true,
          align: true,
          origin: true,
          size: true,
          translate: true,
          skew: true,
          rotate: true,
          scale: true
        },
        spring: {
          dampingRatio: 0.8,
          period: 300
        }
      }
    };
    function _initFlowLayoutNode(node, spec) {
      if (!spec && this.options.flowOptions.insertSpec) {
        node.setSpec(this.options.flowOptions.insertSpec);
      }
    }
    LayoutController.prototype.setOptions = function(options) {
      if ((options.alignment !== undefined) && (options.alignment !== this.options.alignment)) {
        this._isDirty = true;
      }
      this._optionsManager.setOptions(options);
      if (options.nodeSpring) {
        console.warn('nodeSpring options have been moved inside `flowOptions`. Use `flowOptions.spring` instead.');
        this._optionsManager.setOptions({flowOptions: {spring: options.nodeSpring}});
        this._nodes.setNodeOptions(this.options.flowOptions);
      }
      if (options.reflowOnResize !== undefined) {
        console.warn('reflowOnResize options have been moved inside `flowOptions`. Use `flowOptions.reflowOnResize` instead.');
        this._optionsManager.setOptions({flowOptions: {reflowOnResize: options.reflowOnResize}});
        this._nodes.setNodeOptions(this.options.flowOptions);
      }
      if (options.insertSpec) {
        console.warn('insertSpec options have been moved inside `flowOptions`. Use `flowOptions.insertSpec` instead.');
        this._optionsManager.setOptions({flowOptions: {insertSpec: options.insertSpec}});
        this._nodes.setNodeOptions(this.options.flowOptions);
      }
      if (options.removeSpec) {
        console.warn('removeSpec options have been moved inside `flowOptions`. Use `flowOptions.removeSpec` instead.');
        this._optionsManager.setOptions({flowOptions: {removeSpec: options.removeSpec}});
        this._nodes.setNodeOptions(this.options.flowOptions);
      }
      if (options.dataSource) {
        this.setDataSource(options.dataSource);
      }
      if (options.layout) {
        this.setLayout(options.layout, options.layoutOptions);
      } else if (options.layoutOptions) {
        this.setLayoutOptions(options.layoutOptions);
      }
      if (options.direction !== undefined) {
        this.setDirection(options.direction);
      }
      if (options.flowOptions && this.options.flow) {
        this._nodes.setNodeOptions(this.options.flowOptions);
      }
      if (options.preallocateNodes) {
        this._nodes.preallocateNodes(options.preallocateNodes.count || 0, options.preallocateNodes.spec);
      }
      return this;
    };
    function _forEachRenderable(callback) {
      var dataSource = this._dataSource;
      if (dataSource instanceof Array) {
        for (var i = 0,
            j = dataSource.length; i < j; i++) {
          callback(dataSource[i]);
        }
      } else if (dataSource instanceof ViewSequence) {
        var renderable;
        while (dataSource) {
          renderable = dataSource.get();
          if (!renderable) {
            break;
          }
          callback(renderable);
          dataSource = dataSource.getNext();
        }
      } else {
        for (var key in dataSource) {
          callback(dataSource[key]);
        }
      }
    }
    LayoutController.prototype.setDataSource = function(dataSource) {
      this._dataSource = dataSource;
      this._initialViewSequence = undefined;
      this._nodesById = undefined;
      if (dataSource instanceof Array) {
        this._viewSequence = new ViewSequence(dataSource);
        this._initialViewSequence = this._viewSequence;
      } else if ((dataSource instanceof ViewSequence) || dataSource.getNext) {
        this._viewSequence = dataSource;
        this._initialViewSequence = dataSource;
      } else if (dataSource instanceof Object) {
        this._nodesById = dataSource;
      }
      if (this.options.autoPipeEvents) {
        if (this._dataSource.pipe) {
          this._dataSource.pipe(this);
          this._dataSource.pipe(this._eventOutput);
        } else {
          _forEachRenderable.call(this, function(renderable) {
            if (renderable && renderable.pipe) {
              renderable.pipe(this);
              renderable.pipe(this._eventOutput);
            }
          }.bind(this));
        }
      }
      this._isDirty = true;
      return this;
    };
    LayoutController.prototype.getDataSource = function() {
      return this._dataSource;
    };
    LayoutController.prototype.setLayout = function(layout, options) {
      if (layout instanceof Function) {
        this._layout._function = layout;
        this._layout.capabilities = layout.Capabilities;
        this._layout.literal = undefined;
      } else if (layout instanceof Object) {
        this._layout.literal = layout;
        this._layout.capabilities = undefined;
        var helperName = Object.keys(layout)[0];
        var Helper = LayoutUtility.getRegisteredHelper(helperName);
        this._layout._function = Helper ? function(context, options2) {
          var helper = new Helper(context, options2);
          helper.parse(layout[helperName]);
        } : undefined;
      } else {
        this._layout._function = undefined;
        this._layout.capabilities = undefined;
        this._layout.literal = undefined;
      }
      if (options) {
        this.setLayoutOptions(options);
      }
      this.setDirection(this._configuredDirection);
      this._isDirty = true;
      return this;
    };
    LayoutController.prototype.getLayout = function() {
      return this._layout.literal || this._layout._function;
    };
    LayoutController.prototype.setLayoutOptions = function(options) {
      this._layout.optionsManager.setOptions(options);
      return this;
    };
    LayoutController.prototype.getLayoutOptions = function() {
      return this._layout.options;
    };
    function _getActualDirection(direction) {
      if (this._layout.capabilities && this._layout.capabilities.direction) {
        if (Array.isArray(this._layout.capabilities.direction)) {
          for (var i = 0; i < this._layout.capabilities.direction.length; i++) {
            if (this._layout.capabilities.direction[i] === direction) {
              return direction;
            }
          }
          return this._layout.capabilities.direction[0];
        } else {
          return this._layout.capabilities.direction;
        }
      }
      return (direction === undefined) ? Utility.Direction.Y : direction;
    }
    LayoutController.prototype.setDirection = function(direction) {
      this._configuredDirection = direction;
      var newDirection = _getActualDirection.call(this, direction);
      if (newDirection !== this._direction) {
        this._direction = newDirection;
        this._isDirty = true;
      }
    };
    LayoutController.prototype.getDirection = function(actual) {
      return actual ? this._direction : this._configuredDirection;
    };
    LayoutController.prototype.getSpec = function(node, normalize, endState) {
      if (!node) {
        return undefined;
      }
      if ((node instanceof String) || (typeof node === 'string')) {
        if (!this._nodesById) {
          return undefined;
        }
        node = this._nodesById[node];
        if (!node) {
          return undefined;
        }
        if (node instanceof Array) {
          return node;
        }
      }
      if (this._specs) {
        for (var i = 0; i < this._specs.length; i++) {
          var spec = this._specs[i];
          if (spec.renderNode === node) {
            if (endState && spec.endState) {
              spec = spec.endState;
            }
            if (normalize && spec.transform && spec.size && (spec.align || spec.origin)) {
              var transform = spec.transform;
              if (spec.align && (spec.align[0] || spec.align[1])) {
                transform = Transform.thenMove(transform, [spec.align[0] * this._contextSizeCache[0], spec.align[1] * this._contextSizeCache[1], 0]);
              }
              if (spec.origin && (spec.origin[0] || spec.origin[1])) {
                transform = Transform.moveThen([-spec.origin[0] * spec.size[0], -spec.origin[1] * spec.size[1], 0], transform);
              }
              return {
                opacity: spec.opacity,
                size: spec.size,
                transform: transform
              };
            }
            return spec;
          }
        }
      }
      return undefined;
    };
    LayoutController.prototype.reflowLayout = function() {
      this._isDirty = true;
      return this;
    };
    LayoutController.prototype.resetFlowState = function() {
      if (this.options.flow) {
        this._resetFlowState = true;
      }
      return this;
    };
    LayoutController.prototype.insert = function(indexOrId, renderable, insertSpec) {
      if ((indexOrId instanceof String) || (typeof indexOrId === 'string')) {
        if (this._dataSource === undefined) {
          this._dataSource = {};
          this._nodesById = this._dataSource;
        }
        if (this._nodesById[indexOrId] === renderable) {
          return this;
        }
        this._nodesById[indexOrId] = renderable;
      } else {
        if (this._dataSource === undefined) {
          this._dataSource = [];
          this._viewSequence = new ViewSequence(this._dataSource);
          this._initialViewSequence = this._viewSequence;
        }
        var dataSource = this._viewSequence || this._dataSource;
        var array = _getDataSourceArray.call(this);
        if (array && (indexOrId === array.length)) {
          indexOrId = -1;
        }
        if (indexOrId === -1) {
          dataSource.push(renderable);
        } else if (indexOrId === 0) {
          if (dataSource === this._viewSequence) {
            dataSource.splice(0, 0, renderable);
            if (this._viewSequence.getIndex() === 0) {
              var nextViewSequence = this._viewSequence.getNext();
              if (nextViewSequence && nextViewSequence.get()) {
                this._viewSequence = nextViewSequence;
              }
            }
          } else {
            dataSource.splice(0, 0, renderable);
          }
        } else {
          dataSource.splice(indexOrId, 0, renderable);
        }
      }
      if (insertSpec) {
        this._nodes.insertNode(this._nodes.createNode(renderable, insertSpec));
      }
      if (this.options.autoPipeEvents && renderable && renderable.pipe) {
        renderable.pipe(this);
        renderable.pipe(this._eventOutput);
      }
      this._isDirty = true;
      return this;
    };
    LayoutController.prototype.push = function(renderable, insertSpec) {
      return this.insert(-1, renderable, insertSpec);
    };
    function _getViewSequenceAtIndex(index, startViewSequence) {
      var viewSequence = startViewSequence || this._viewSequence;
      var i = viewSequence ? viewSequence.getIndex() : index;
      if (index > i) {
        while (viewSequence) {
          viewSequence = viewSequence.getNext();
          if (!viewSequence) {
            return undefined;
          }
          i = viewSequence.getIndex();
          if (i === index) {
            return viewSequence;
          } else if (index < i) {
            return undefined;
          }
        }
      } else if (index < i) {
        while (viewSequence) {
          viewSequence = viewSequence.getPrevious();
          if (!viewSequence) {
            return undefined;
          }
          i = viewSequence.getIndex();
          if (i === index) {
            return viewSequence;
          } else if (index > i) {
            return undefined;
          }
        }
      }
      return viewSequence;
    }
    function _getDataSourceArray() {
      if (Array.isArray(this._dataSource)) {
        return this._dataSource;
      } else if (this._viewSequence || this._viewSequence._) {
        return this._viewSequence._.array;
      }
      return undefined;
    }
    LayoutController.prototype.get = function(indexOrId) {
      if (this._nodesById || (indexOrId instanceof String) || (typeof indexOrId === 'string')) {
        return this._nodesById[indexOrId];
      }
      var viewSequence = _getViewSequenceAtIndex.call(this, indexOrId);
      return viewSequence ? viewSequence.get() : undefined;
    };
    LayoutController.prototype.swap = function(index, index2) {
      var array = _getDataSourceArray.call(this);
      if (!array) {
        throw '.swap is only supported for dataSources of type Array or ViewSequence';
      }
      if (index === index2) {
        return this;
      }
      if ((index < 0) || (index >= array.length)) {
        throw 'Invalid index (' + index + ') specified to .swap';
      }
      if ((index2 < 0) || (index2 >= array.length)) {
        throw 'Invalid second index (' + index2 + ') specified to .swap';
      }
      var renderNode = array[index];
      array[index] = array[index2];
      array[index2] = renderNode;
      this._isDirty = true;
      return this;
    };
    LayoutController.prototype.replace = function(indexOrId, renderable, noAnimation) {
      var oldRenderable;
      if (this._nodesById || (indexOrId instanceof String) || (typeof indexOrId === 'string')) {
        oldRenderable = this._nodesById[indexOrId];
        if (oldRenderable !== renderable) {
          if (noAnimation && oldRenderable) {
            var node = this._nodes.getNodeByRenderNode(oldRenderable);
            if (node) {
              node.setRenderNode(renderable);
            }
          }
          this._nodesById[indexOrId] = renderable;
          this._isDirty = true;
        }
        return oldRenderable;
      }
      var array = _getDataSourceArray.call(this);
      if (!array) {
        return undefined;
      }
      if ((indexOrId < 0) || (indexOrId >= array.length)) {
        throw 'Invalid index (' + indexOrId + ') specified to .replace';
      }
      oldRenderable = array[indexOrId];
      if (oldRenderable !== renderable) {
        array[indexOrId] = renderable;
        this._isDirty = true;
      }
      return oldRenderable;
    };
    LayoutController.prototype.move = function(index, newIndex) {
      var array = _getDataSourceArray.call(this);
      if (!array) {
        throw '.move is only supported for dataSources of type Array or ViewSequence';
      }
      if ((index < 0) || (index >= array.length)) {
        throw 'Invalid index (' + index + ') specified to .move';
      }
      if ((newIndex < 0) || (newIndex >= array.length)) {
        throw 'Invalid newIndex (' + newIndex + ') specified to .move';
      }
      var item = array.splice(index, 1)[0];
      array.splice(newIndex, 0, item);
      this._isDirty = true;
      return this;
    };
    LayoutController.prototype.remove = function(indexOrId, removeSpec) {
      var renderNode;
      if (this._nodesById || (indexOrId instanceof String) || (typeof indexOrId === 'string')) {
        if ((indexOrId instanceof String) || (typeof indexOrId === 'string')) {
          renderNode = this._nodesById[indexOrId];
          if (renderNode) {
            delete this._nodesById[indexOrId];
          }
        } else {
          for (var key in this._nodesById) {
            if (this._nodesById[key] === indexOrId) {
              delete this._nodesById[key];
              renderNode = indexOrId;
              break;
            }
          }
        }
      } else if ((indexOrId instanceof Number) || (typeof indexOrId === 'number')) {
        var array = _getDataSourceArray.call(this);
        if (!array || (indexOrId < 0) || (indexOrId >= array.length)) {
          throw 'Invalid index (' + indexOrId + ') specified to .remove (or dataSource doesn\'t support remove)';
        }
        renderNode = array[indexOrId];
        this._dataSource.splice(indexOrId, 1);
      } else {
        indexOrId = this._dataSource.indexOf(indexOrId);
        if (indexOrId >= 0) {
          this._dataSource.splice(indexOrId, 1);
          renderNode = indexOrId;
        }
      }
      if (this._viewSequence && renderNode) {
        var viewSequence = _getViewSequenceAtIndex.call(this, this._viewSequence.getIndex(), this._initialViewSequence);
        viewSequence = viewSequence || _getViewSequenceAtIndex.call(this, this._viewSequence.getIndex() - 1, this._initialViewSequence);
        viewSequence = viewSequence || this._dataSource;
        this._viewSequence = viewSequence;
      }
      if (renderNode && removeSpec) {
        var node = this._nodes.getNodeByRenderNode(renderNode);
        if (node) {
          node.remove(removeSpec || this.options.flowOptions.removeSpec);
        }
      }
      if (renderNode) {
        this._isDirty = true;
      }
      return renderNode;
    };
    LayoutController.prototype.removeAll = function(removeSpec) {
      if (this._nodesById) {
        var dirty = false;
        for (var key in this._nodesById) {
          delete this._nodesById[key];
          dirty = true;
        }
        if (dirty) {
          this._isDirty = true;
        }
      } else if (this._dataSource) {
        this.setDataSource([]);
      }
      if (removeSpec) {
        var node = this._nodes.getStartEnumNode();
        while (node) {
          node.remove(removeSpec || this.options.flowOptions.removeSpec);
          node = node._next;
        }
      }
      return this;
    };
    LayoutController.prototype.getSize = function() {
      return this._size || this.options.size;
    };
    LayoutController.prototype.render = function render() {
      return this.id;
    };
    LayoutController.prototype.commit = function commit(context) {
      var transform = context.transform;
      var origin = context.origin;
      var size = context.size;
      var opacity = context.opacity;
      if (this._resetFlowState) {
        this._resetFlowState = false;
        this._isDirty = true;
        this._nodes.removeAll();
      }
      if (size[0] !== this._contextSizeCache[0] || size[1] !== this._contextSizeCache[1] || this._isDirty || this._nodes._trueSizeRequested || this.options.alwaysLayout) {
        var eventData = {
          target: this,
          oldSize: this._contextSizeCache,
          size: size,
          dirty: this._isDirty,
          trueSizeRequested: this._nodes._trueSizeRequested
        };
        this._eventOutput.emit('layoutstart', eventData);
        if (this.options.flow) {
          var lock = false;
          if (!this.options.flowOptions.reflowOnResize) {
            if (!this._isDirty && ((size[0] !== this._contextSizeCache[0]) || (size[1] !== this._contextSizeCache[1]))) {
              lock = undefined;
            } else {
              lock = true;
            }
          }
          if (lock !== undefined) {
            var node = this._nodes.getStartEnumNode();
            while (node) {
              node.releaseLock(lock);
              node = node._next;
            }
          }
        }
        this._contextSizeCache[0] = size[0];
        this._contextSizeCache[1] = size[1];
        this._isDirty = false;
        var scrollEnd;
        if (this.options.size && (this.options.size[this._direction] === true)) {
          scrollEnd = 1000000;
        }
        var layoutContext = this._nodes.prepareForLayout(this._viewSequence, this._nodesById, {
          size: size,
          direction: this._direction,
          scrollEnd: scrollEnd
        });
        if (this._layout._function) {
          this._layout._function(layoutContext, this._layout.options);
        }
        this._nodes.removeNonInvalidatedNodes(this.options.flowOptions.removeSpec);
        this._nodes.removeVirtualViewSequenceNodes();
        if (scrollEnd) {
          scrollEnd = 0;
          node = this._nodes.getStartEnumNode();
          while (node) {
            if (node._invalidated && node.scrollLength) {
              scrollEnd += node.scrollLength;
            }
            node = node._next;
          }
          this._size = this._size || [0, 0];
          this._size[0] = this.options.size[0];
          this._size[1] = this.options.size[1];
          this._size[this._direction] = scrollEnd;
        }
        var result = this._nodes.buildSpecAndDestroyUnrenderedNodes();
        this._specs = result.specs;
        this._commitOutput.target = result.specs;
        this._eventOutput.emit('layoutend', eventData);
        this._eventOutput.emit('reflow', {target: this});
      } else if (this.options.flow) {
        result = this._nodes.buildSpecAndDestroyUnrenderedNodes();
        this._specs = result.specs;
        this._commitOutput.target = result.specs;
        if (result.modified) {
          this._eventOutput.emit('reflow', {target: this});
        }
      }
      var target = this._commitOutput.target;
      for (var i = 0,
          j = target.length; i < j; i++) {
        if (target[i].renderNode) {
          target[i].target = target[i].renderNode.render();
        }
      }
      if (!target.length || (target[target.length - 1] !== this._cleanupRegistration)) {
        target.push(this._cleanupRegistration);
      }
      if (origin && ((origin[0] !== 0) || (origin[1] !== 0))) {
        transform = Transform.moveThen([-size[0] * origin[0], -size[1] * origin[1], 0], transform);
      }
      this._commitOutput.size = size;
      this._commitOutput.opacity = opacity;
      this._commitOutput.transform = transform;
      return this._commitOutput;
    };
    LayoutController.prototype.cleanup = function(context) {
      if (this.options.flow) {
        this._resetFlowState = true;
      }
    };
    module.exports = LayoutController;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("views/ChupPlayView", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "npm:famous@0.3.5/core/View", "utils/objectHelper", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "github:ijzerenhein/famous-bkimagesurface@1.0.3/BkImageSurface", "github:ijzerenhein/famous-flex@0.3.1/src/FlexScrollView", "npm:famous@0.3.5/utilities/Utility"], function($__export) {
  "use strict";
  var __moduleName = "views/ChupPlayView";
  var Engine,
      Surface,
      View,
      ObjectHelper,
      LayoutController,
      BkImageSurface,
      FlexScrollView,
      Utility,
      DEFAULT_OPTIONS,
      ChupPlayView;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      View = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      BkImageSurface = $__m.default;
    }, function($__m) {
      FlexScrollView = $__m.default;
    }, function($__m) {
      Utility = $__m.default;
    }],
    execute: function() {
      DEFAULT_OPTIONS = {margin: 10};
      ChupPlayView = $__export("ChupPlayView", (function($__super) {
        var ChupPlayView = function ChupPlayView(options) {
          $traceurRuntime.superConstructor(ChupPlayView).call(this, DEFAULT_OPTIONS);
          this.id = options;
          ObjectHelper.bindAllMethods(this, this);
          ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);
          ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');
          this._createRenderables(this.id);
          this._createLayout(this.id);
        };
        return ($traceurRuntime.createClass)(ChupPlayView, {
          _createRenderables: function(options) {
            var scrollView = new FlexScrollView({
              autoPipeEvents: true,
              mouseMove: true
            });
            scrollView.push(new Surface({content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in tellus in lectus congue feugiat. Suspendisse vitae accumsan risus, a congue quam. Integer eget lacinia ligula. Sed consectetur tellus consequat ex aliquet, vel commodo arcu rhoncus. Nam laoreet, ligula non pharetra vehicula, urna lorem auctor odio, ut vehicula lacus metus vel eros. Praesent vitae fermentum nibh. Morbi nec ornare dui, sit amet viverra massa. Nullam imperdiet mattis ex, non volutpat sem. Phasellus sit amet varius nunc. Aenean consectetur ac ipsum auctor lacinia. Vestibulum aliquam congue porttitor. Pellentesque at nisl auctor, eleifend enim id, blandit augue. Nunc ornare ut ex quis semper. Aliquam blandit, diam nec commodo malesuada, nulla enim maximus sapien, sit amet gravida leo massa quis magna. Cras pretium neque vel mi dignissim, non blandit leo lobortis. Integer tincidunt posuere nisi. Praesent nisi ipsum, blandit vitae maximus ut, rutrum vitae odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in tellus in lectus congue feugiat. Suspendisse vitae accumsan risus, a congue quam. Integer eget lacinia ligula. Sed consectetur tellus consequat ex aliquet, vel commodo arcu rhoncus. Nam laoreet, ligula non pharetra vehicula, urna lorem auctor odio, ut vehicula lacus metus vel eros. Praesent vitae fermentum nibh. Morbi nec ornare dui, sit amet viverra massa. Nullam imperdiet mattis ex, non volutpat sem. Phasellus sit amet varius nunc. Aenean consectetur ac ipsum auctor lacinia. Vestibulum aliquam congue porttitor. Pellentesque at nisl auctor, eleifend enim id, blandit augue. Nunc ornare ut ex quis semper. Aliquam blandit, diam nec commodo malesuada, nulla enim maximus sapien, sit amet gravida leo massa quis magna. Cras pretium neque vel mi dignissim, non blandit leo lobortis. Integer tincidunt posuere nisi. Praesent nisi ipsum, blandit vitae maximus ut, rutrum vitae odio.'}));
            scrollView.push(new Surface({
              size: [undefined, 200],
              content: ''
            }));
            this._renderables = {
              infopanel: scrollView,
              next: new BkImageSurface({
                size: [32, 32],
                content: 'img/next.png',
                backgroundColor: 'yellow'
              })
            };
            this._renderables['chupheader' + this.id] = new BkImageSurface({
              content: 'img/sf' + this.id + '.jpg',
              sizeMode: 'cover'
            });
          },
          _createLayout: function(id) {
            this.layout = new LayoutController({
              autoPipeEvents: true,
              layout: function(context, options) {
                var infoPanelSize = [context.size[0], context.size[1] * 0.2];
                context.set('chupheader' + this.id, {
                  size: infoPanelSize,
                  translate: [0, 0, 1]
                });
                context.set('infopanel', {
                  size: [context.size[0] - this.options.margin * 2, undefined],
                  translate: [this.options.margin, (context.size[1] * 0.2) + this.options.margin, -1]
                });
                context.set('next', {
                  origin: [0.5, 0.5],
                  align: [0.9, 0.1],
                  translate: [0, 0, 2]
                });
              }.bind(this),
              dataSource: this._renderables
            });
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
          }
        }, {}, $__super);
      }(View)));
    }
  };
});



System.register("settings", ["github:angular/di.js@master", "github:Bizboard/arva-ds@master/core/DataSource", "github:Bizboard/arva-ds@master/datasources/FirebaseDataSource"], function($__export) {
  "use strict";
  var __moduleName = "settings";
  var annotate,
      Provide,
      DataSource,
      FirebaseDataSource;
  function DefaultDataSource() {
    return new FirebaseDataSource("https://<yourapp>.firebaseio.com");
  }
  $__export("DefaultDataSource", DefaultDataSource);
  return {
    setters: [function($__m) {
      annotate = $__m.annotate;
      Provide = $__m.Provide;
    }, function($__m) {
      DataSource = $__m.DataSource;
    }, function($__m) {
      FirebaseDataSource = $__m.FirebaseDataSource;
    }],
    execute: function() {
      annotate(DefaultDataSource, new Provide(DataSource));
    }
  };
});



System.register("github:angular/di.js@master", ["github:angular/di.js@master/index"], function($__export) {
  "use strict";
  var __moduleName = "github:angular/di.js@master";
  var $__exportNames = {};
  return {
    setters: [function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }],
    execute: function() {}
  };
});



System.register("npm:lodash@3.7.0/index", ["github:jspm/nodelibs-process@0.1.1"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  (function(process) {
    ;
    (function() {
      var undefined;
      var VERSION = '3.7.0';
      var BIND_FLAG = 1,
          BIND_KEY_FLAG = 2,
          CURRY_BOUND_FLAG = 4,
          CURRY_FLAG = 8,
          CURRY_RIGHT_FLAG = 16,
          PARTIAL_FLAG = 32,
          PARTIAL_RIGHT_FLAG = 64,
          ARY_FLAG = 128,
          REARG_FLAG = 256;
      var DEFAULT_TRUNC_LENGTH = 30,
          DEFAULT_TRUNC_OMISSION = '...';
      var HOT_COUNT = 150,
          HOT_SPAN = 16;
      var LAZY_DROP_WHILE_FLAG = 0,
          LAZY_FILTER_FLAG = 1,
          LAZY_MAP_FLAG = 2;
      var FUNC_ERROR_TEXT = 'Expected a function';
      var PLACEHOLDER = '__lodash_placeholder__';
      var argsTag = '[object Arguments]',
          arrayTag = '[object Array]',
          boolTag = '[object Boolean]',
          dateTag = '[object Date]',
          errorTag = '[object Error]',
          funcTag = '[object Function]',
          mapTag = '[object Map]',
          numberTag = '[object Number]',
          objectTag = '[object Object]',
          regexpTag = '[object RegExp]',
          setTag = '[object Set]',
          stringTag = '[object String]',
          weakMapTag = '[object WeakMap]';
      var arrayBufferTag = '[object ArrayBuffer]',
          float32Tag = '[object Float32Array]',
          float64Tag = '[object Float64Array]',
          int8Tag = '[object Int8Array]',
          int16Tag = '[object Int16Array]',
          int32Tag = '[object Int32Array]',
          uint8Tag = '[object Uint8Array]',
          uint8ClampedTag = '[object Uint8ClampedArray]',
          uint16Tag = '[object Uint16Array]',
          uint32Tag = '[object Uint32Array]';
      var reEmptyStringLeading = /\b__p \+= '';/g,
          reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
          reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
      var reEscapedHtml = /&(?:amp|lt|gt|quot|#39|#96);/g,
          reUnescapedHtml = /[&<>"'`]/g,
          reHasEscapedHtml = RegExp(reEscapedHtml.source),
          reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
      var reEscape = /<%-([\s\S]+?)%>/g,
          reEvaluate = /<%([\s\S]+?)%>/g,
          reInterpolate = /<%=([\s\S]+?)%>/g;
      var reIsDeepProp = /\.|\[(?:[^[\]]+|(["'])(?:(?!\1)[^\n\\]|\\.)*?)\1\]/,
          reIsPlainProp = /^\w*$/,
          rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\n\\]|\\.)*?)\2)\]/g;
      var reRegExpChars = /[.*+?^${}()|[\]\/\\]/g,
          reHasRegExpChars = RegExp(reRegExpChars.source);
      var reComboMark = /[\u0300-\u036f\ufe20-\ufe23]/g;
      var reEscapeChar = /\\(\\)?/g;
      var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
      var reFlags = /\w*$/;
      var reHasHexPrefix = /^0[xX]/;
      var reIsHostCtor = /^\[object .+?Constructor\]$/;
      var reLatin1 = /[\xc0-\xd6\xd8-\xde\xdf-\xf6\xf8-\xff]/g;
      var reNoMatch = /($^)/;
      var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
      var reWords = (function() {
        var upper = '[A-Z\\xc0-\\xd6\\xd8-\\xde]',
            lower = '[a-z\\xdf-\\xf6\\xf8-\\xff]+';
        return RegExp(upper + '+(?=' + upper + lower + ')|' + upper + '?' + lower + '|' + upper + '+|[0-9]+', 'g');
      }());
      var whitespace = (' \t\x0b\f\xa0\ufeff' + '\n\r\u2028\u2029' + '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000');
      var contextProps = ['Array', 'ArrayBuffer', 'Date', 'Error', 'Float32Array', 'Float64Array', 'Function', 'Int8Array', 'Int16Array', 'Int32Array', 'Math', 'Number', 'Object', 'RegExp', 'Set', 'String', '_', 'clearTimeout', 'document', 'isFinite', 'parseInt', 'setTimeout', 'TypeError', 'Uint8Array', 'Uint8ClampedArray', 'Uint16Array', 'Uint32Array', 'WeakMap', 'window'];
      var templateCounter = -1;
      var typedArrayTags = {};
      typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
      typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
      var cloneableTags = {};
      cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[stringTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
      cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[mapTag] = cloneableTags[setTag] = cloneableTags[weakMapTag] = false;
      var debounceOptions = {
        'leading': false,
        'maxWait': 0,
        'trailing': false
      };
      var deburredLetters = {
        '\xc0': 'A',
        '\xc1': 'A',
        '\xc2': 'A',
        '\xc3': 'A',
        '\xc4': 'A',
        '\xc5': 'A',
        '\xe0': 'a',
        '\xe1': 'a',
        '\xe2': 'a',
        '\xe3': 'a',
        '\xe4': 'a',
        '\xe5': 'a',
        '\xc7': 'C',
        '\xe7': 'c',
        '\xd0': 'D',
        '\xf0': 'd',
        '\xc8': 'E',
        '\xc9': 'E',
        '\xca': 'E',
        '\xcb': 'E',
        '\xe8': 'e',
        '\xe9': 'e',
        '\xea': 'e',
        '\xeb': 'e',
        '\xcC': 'I',
        '\xcd': 'I',
        '\xce': 'I',
        '\xcf': 'I',
        '\xeC': 'i',
        '\xed': 'i',
        '\xee': 'i',
        '\xef': 'i',
        '\xd1': 'N',
        '\xf1': 'n',
        '\xd2': 'O',
        '\xd3': 'O',
        '\xd4': 'O',
        '\xd5': 'O',
        '\xd6': 'O',
        '\xd8': 'O',
        '\xf2': 'o',
        '\xf3': 'o',
        '\xf4': 'o',
        '\xf5': 'o',
        '\xf6': 'o',
        '\xf8': 'o',
        '\xd9': 'U',
        '\xda': 'U',
        '\xdb': 'U',
        '\xdc': 'U',
        '\xf9': 'u',
        '\xfa': 'u',
        '\xfb': 'u',
        '\xfc': 'u',
        '\xdd': 'Y',
        '\xfd': 'y',
        '\xff': 'y',
        '\xc6': 'Ae',
        '\xe6': 'ae',
        '\xde': 'Th',
        '\xfe': 'th',
        '\xdf': 'ss'
      };
      var htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
      };
      var htmlUnescapes = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#96;': '`'
      };
      var objectTypes = {
        'function': true,
        'object': true
      };
      var stringEscapes = {
        '\\': '\\',
        "'": "'",
        '\n': 'n',
        '\r': 'r',
        '\u2028': 'u2028',
        '\u2029': 'u2029'
      };
      var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;
      var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;
      var freeGlobal = freeExports && freeModule && typeof global == 'object' && global && global.Object && global;
      var freeSelf = objectTypes[typeof self] && self && self.Object && self;
      var freeWindow = objectTypes[typeof window] && window && window.Object && window;
      var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;
      var root = freeGlobal || ((freeWindow !== (this && this.window)) && freeWindow) || freeSelf || this;
      function baseCompareAscending(value, other) {
        if (value !== other) {
          var valIsReflexive = value === value,
              othIsReflexive = other === other;
          if (value > other || !valIsReflexive || (value === undefined && othIsReflexive)) {
            return 1;
          }
          if (value < other || !othIsReflexive || (other === undefined && valIsReflexive)) {
            return -1;
          }
        }
        return 0;
      }
      function baseFindIndex(array, predicate, fromRight) {
        var length = array.length,
            index = fromRight ? length : -1;
        while ((fromRight ? index-- : ++index < length)) {
          if (predicate(array[index], index, array)) {
            return index;
          }
        }
        return -1;
      }
      function baseIndexOf(array, value, fromIndex) {
        if (value !== value) {
          return indexOfNaN(array, fromIndex);
        }
        var index = fromIndex - 1,
            length = array.length;
        while (++index < length) {
          if (array[index] === value) {
            return index;
          }
        }
        return -1;
      }
      function baseIsFunction(value) {
        return typeof value == 'function' || false;
      }
      function baseToString(value) {
        if (typeof value == 'string') {
          return value;
        }
        return value == null ? '' : (value + '');
      }
      function charAtCallback(string) {
        return string.charCodeAt(0);
      }
      function charsLeftIndex(string, chars) {
        var index = -1,
            length = string.length;
        while (++index < length && chars.indexOf(string.charAt(index)) > -1) {}
        return index;
      }
      function charsRightIndex(string, chars) {
        var index = string.length;
        while (index-- && chars.indexOf(string.charAt(index)) > -1) {}
        return index;
      }
      function compareAscending(object, other) {
        return baseCompareAscending(object.criteria, other.criteria) || (object.index - other.index);
      }
      function compareMultiple(object, other, orders) {
        var index = -1,
            objCriteria = object.criteria,
            othCriteria = other.criteria,
            length = objCriteria.length,
            ordersLength = orders.length;
        while (++index < length) {
          var result = baseCompareAscending(objCriteria[index], othCriteria[index]);
          if (result) {
            if (index >= ordersLength) {
              return result;
            }
            return result * (orders[index] ? 1 : -1);
          }
        }
        return object.index - other.index;
      }
      function deburrLetter(letter) {
        return deburredLetters[letter];
      }
      function escapeHtmlChar(chr) {
        return htmlEscapes[chr];
      }
      function escapeStringChar(chr) {
        return '\\' + stringEscapes[chr];
      }
      function indexOfNaN(array, fromIndex, fromRight) {
        var length = array.length,
            index = fromIndex + (fromRight ? 0 : -1);
        while ((fromRight ? index-- : ++index < length)) {
          var other = array[index];
          if (other !== other) {
            return index;
          }
        }
        return -1;
      }
      function isObjectLike(value) {
        return !!value && typeof value == 'object';
      }
      function isSpace(charCode) {
        return ((charCode <= 160 && (charCode >= 9 && charCode <= 13) || charCode == 32 || charCode == 160) || charCode == 5760 || charCode == 6158 || (charCode >= 8192 && (charCode <= 8202 || charCode == 8232 || charCode == 8233 || charCode == 8239 || charCode == 8287 || charCode == 12288 || charCode == 65279)));
      }
      function replaceHolders(array, placeholder) {
        var index = -1,
            length = array.length,
            resIndex = -1,
            result = [];
        while (++index < length) {
          if (array[index] === placeholder) {
            array[index] = PLACEHOLDER;
            result[++resIndex] = index;
          }
        }
        return result;
      }
      function sortedUniq(array, iteratee) {
        var seen,
            index = -1,
            length = array.length,
            resIndex = -1,
            result = [];
        while (++index < length) {
          var value = array[index],
              computed = iteratee ? iteratee(value, index, array) : value;
          if (!index || seen !== computed) {
            seen = computed;
            result[++resIndex] = value;
          }
        }
        return result;
      }
      function trimmedLeftIndex(string) {
        var index = -1,
            length = string.length;
        while (++index < length && isSpace(string.charCodeAt(index))) {}
        return index;
      }
      function trimmedRightIndex(string) {
        var index = string.length;
        while (index-- && isSpace(string.charCodeAt(index))) {}
        return index;
      }
      function unescapeHtmlChar(chr) {
        return htmlUnescapes[chr];
      }
      function runInContext(context) {
        context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;
        var Array = context.Array,
            Date = context.Date,
            Error = context.Error,
            Function = context.Function,
            Math = context.Math,
            Number = context.Number,
            Object = context.Object,
            RegExp = context.RegExp,
            String = context.String,
            TypeError = context.TypeError;
        var arrayProto = Array.prototype,
            objectProto = Object.prototype,
            stringProto = String.prototype;
        var document = (document = context.window) && document.document;
        var fnToString = Function.prototype.toString;
        var hasOwnProperty = objectProto.hasOwnProperty;
        var idCounter = 0;
        var objToString = objectProto.toString;
        var oldDash = context._;
        var reIsNative = RegExp('^' + escapeRegExp(objToString).replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
        var ArrayBuffer = isNative(ArrayBuffer = context.ArrayBuffer) && ArrayBuffer,
            bufferSlice = isNative(bufferSlice = ArrayBuffer && new ArrayBuffer(0).slice) && bufferSlice,
            ceil = Math.ceil,
            clearTimeout = context.clearTimeout,
            floor = Math.floor,
            getOwnPropertySymbols = isNative(getOwnPropertySymbols = Object.getOwnPropertySymbols) && getOwnPropertySymbols,
            getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
            push = arrayProto.push,
            preventExtensions = isNative(Object.preventExtensions = Object.preventExtensions) && preventExtensions,
            propertyIsEnumerable = objectProto.propertyIsEnumerable,
            Set = isNative(Set = context.Set) && Set,
            setTimeout = context.setTimeout,
            splice = arrayProto.splice,
            Uint8Array = isNative(Uint8Array = context.Uint8Array) && Uint8Array,
            WeakMap = isNative(WeakMap = context.WeakMap) && WeakMap;
        var Float64Array = (function() {
          try {
            var func = isNative(func = context.Float64Array) && func,
                result = new func(new ArrayBuffer(10), 0, 1) && func;
          } catch (e) {}
          return result;
        }());
        var nativeAssign = (function() {
          var object = {'1': 0},
              func = preventExtensions && isNative(func = Object.assign) && func;
          try {
            func(preventExtensions(object), 'xo');
          } catch (e) {}
          return !object[1] && func;
        }());
        var nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
            nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
            nativeIsFinite = context.isFinite,
            nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
            nativeMax = Math.max,
            nativeMin = Math.min,
            nativeNow = isNative(nativeNow = Date.now) && nativeNow,
            nativeNumIsFinite = isNative(nativeNumIsFinite = Number.isFinite) && nativeNumIsFinite,
            nativeParseInt = context.parseInt,
            nativeRandom = Math.random;
        var NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY,
            POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
        var MAX_ARRAY_LENGTH = Math.pow(2, 32) - 1,
            MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1,
            HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
        var FLOAT64_BYTES_PER_ELEMENT = Float64Array ? Float64Array.BYTES_PER_ELEMENT : 0;
        var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
        var metaMap = WeakMap && new WeakMap;
        var realNames = {};
        function lodash(value) {
          if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
            if (value instanceof LodashWrapper) {
              return value;
            }
            if (hasOwnProperty.call(value, '__chain__') && hasOwnProperty.call(value, '__wrapped__')) {
              return wrapperClone(value);
            }
          }
          return new LodashWrapper(value);
        }
        function baseLodash() {}
        function LodashWrapper(value, chainAll, actions) {
          this.__wrapped__ = value;
          this.__actions__ = actions || [];
          this.__chain__ = !!chainAll;
        }
        var support = lodash.support = {};
        (function(x) {
          var Ctor = function() {
            this.x = x;
          },
              object = {
                '0': x,
                'length': x
              },
              props = [];
          Ctor.prototype = {
            'valueOf': x,
            'y': x
          };
          for (var key in new Ctor) {
            props.push(key);
          }
          support.funcDecomp = /\bthis\b/.test(function() {
            return this;
          });
          support.funcNames = typeof Function.name == 'string';
          try {
            support.dom = document.createDocumentFragment().nodeType === 11;
          } catch (e) {
            support.dom = false;
          }
          try {
            support.nonEnumArgs = !propertyIsEnumerable.call(arguments, 1);
          } catch (e) {
            support.nonEnumArgs = true;
          }
        }(1, 0));
        lodash.templateSettings = {
          'escape': reEscape,
          'evaluate': reEvaluate,
          'interpolate': reInterpolate,
          'variable': '',
          'imports': {'_': lodash}
        };
        function LazyWrapper(value) {
          this.__wrapped__ = value;
          this.__actions__ = null;
          this.__dir__ = 1;
          this.__dropCount__ = 0;
          this.__filtered__ = false;
          this.__iteratees__ = null;
          this.__takeCount__ = POSITIVE_INFINITY;
          this.__views__ = null;
        }
        function lazyClone() {
          var actions = this.__actions__,
              iteratees = this.__iteratees__,
              views = this.__views__,
              result = new LazyWrapper(this.__wrapped__);
          result.__actions__ = actions ? arrayCopy(actions) : null;
          result.__dir__ = this.__dir__;
          result.__filtered__ = this.__filtered__;
          result.__iteratees__ = iteratees ? arrayCopy(iteratees) : null;
          result.__takeCount__ = this.__takeCount__;
          result.__views__ = views ? arrayCopy(views) : null;
          return result;
        }
        function lazyReverse() {
          if (this.__filtered__) {
            var result = new LazyWrapper(this);
            result.__dir__ = -1;
            result.__filtered__ = true;
          } else {
            result = this.clone();
            result.__dir__ *= -1;
          }
          return result;
        }
        function lazyValue() {
          var array = this.__wrapped__.value();
          if (!isArray(array)) {
            return baseWrapperValue(array, this.__actions__);
          }
          var dir = this.__dir__,
              isRight = dir < 0,
              view = getView(0, array.length, this.__views__),
              start = view.start,
              end = view.end,
              length = end - start,
              index = isRight ? end : (start - 1),
              takeCount = nativeMin(length, this.__takeCount__),
              iteratees = this.__iteratees__,
              iterLength = iteratees ? iteratees.length : 0,
              resIndex = 0,
              result = [];
          outer: while (length-- && resIndex < takeCount) {
            index += dir;
            var iterIndex = -1,
                value = array[index];
            while (++iterIndex < iterLength) {
              var data = iteratees[iterIndex],
                  iteratee = data.iteratee,
                  type = data.type;
              if (type == LAZY_DROP_WHILE_FLAG) {
                if (data.done && (isRight ? (index > data.index) : (index < data.index))) {
                  data.count = 0;
                  data.done = false;
                }
                data.index = index;
                if (!data.done) {
                  var limit = data.limit;
                  if (!(data.done = limit > -1 ? (data.count++ >= limit) : !iteratee(value))) {
                    continue outer;
                  }
                }
              } else {
                var computed = iteratee(value);
                if (type == LAZY_MAP_FLAG) {
                  value = computed;
                } else if (!computed) {
                  if (type == LAZY_FILTER_FLAG) {
                    continue outer;
                  } else {
                    break outer;
                  }
                }
              }
            }
            result[resIndex++] = value;
          }
          return result;
        }
        function MapCache() {
          this.__data__ = {};
        }
        function mapDelete(key) {
          return this.has(key) && delete this.__data__[key];
        }
        function mapGet(key) {
          return key == '__proto__' ? undefined : this.__data__[key];
        }
        function mapHas(key) {
          return key != '__proto__' && hasOwnProperty.call(this.__data__, key);
        }
        function mapSet(key, value) {
          if (key != '__proto__') {
            this.__data__[key] = value;
          }
          return this;
        }
        function SetCache(values) {
          var length = values ? values.length : 0;
          this.data = {
            'hash': nativeCreate(null),
            'set': new Set
          };
          while (length--) {
            this.push(values[length]);
          }
        }
        function cacheIndexOf(cache, value) {
          var data = cache.data,
              result = (typeof value == 'string' || isObject(value)) ? data.set.has(value) : data.hash[value];
          return result ? 0 : -1;
        }
        function cachePush(value) {
          var data = this.data;
          if (typeof value == 'string' || isObject(value)) {
            data.set.add(value);
          } else {
            data.hash[value] = true;
          }
        }
        function arrayCopy(source, array) {
          var index = -1,
              length = source.length;
          array || (array = Array(length));
          while (++index < length) {
            array[index] = source[index];
          }
          return array;
        }
        function arrayEach(array, iteratee) {
          var index = -1,
              length = array.length;
          while (++index < length) {
            if (iteratee(array[index], index, array) === false) {
              break;
            }
          }
          return array;
        }
        function arrayEachRight(array, iteratee) {
          var length = array.length;
          while (length--) {
            if (iteratee(array[length], length, array) === false) {
              break;
            }
          }
          return array;
        }
        function arrayEvery(array, predicate) {
          var index = -1,
              length = array.length;
          while (++index < length) {
            if (!predicate(array[index], index, array)) {
              return false;
            }
          }
          return true;
        }
        function arrayFilter(array, predicate) {
          var index = -1,
              length = array.length,
              resIndex = -1,
              result = [];
          while (++index < length) {
            var value = array[index];
            if (predicate(value, index, array)) {
              result[++resIndex] = value;
            }
          }
          return result;
        }
        function arrayMap(array, iteratee) {
          var index = -1,
              length = array.length,
              result = Array(length);
          while (++index < length) {
            result[index] = iteratee(array[index], index, array);
          }
          return result;
        }
        function arrayMax(array) {
          var index = -1,
              length = array.length,
              result = NEGATIVE_INFINITY;
          while (++index < length) {
            var value = array[index];
            if (value > result) {
              result = value;
            }
          }
          return result;
        }
        function arrayMin(array) {
          var index = -1,
              length = array.length,
              result = POSITIVE_INFINITY;
          while (++index < length) {
            var value = array[index];
            if (value < result) {
              result = value;
            }
          }
          return result;
        }
        function arrayReduce(array, iteratee, accumulator, initFromArray) {
          var index = -1,
              length = array.length;
          if (initFromArray && length) {
            accumulator = array[++index];
          }
          while (++index < length) {
            accumulator = iteratee(accumulator, array[index], index, array);
          }
          return accumulator;
        }
        function arrayReduceRight(array, iteratee, accumulator, initFromArray) {
          var length = array.length;
          if (initFromArray && length) {
            accumulator = array[--length];
          }
          while (length--) {
            accumulator = iteratee(accumulator, array[length], length, array);
          }
          return accumulator;
        }
        function arraySome(array, predicate) {
          var index = -1,
              length = array.length;
          while (++index < length) {
            if (predicate(array[index], index, array)) {
              return true;
            }
          }
          return false;
        }
        function arraySum(array) {
          var length = array.length,
              result = 0;
          while (length--) {
            result += +array[length] || 0;
          }
          return result;
        }
        function assignDefaults(objectValue, sourceValue) {
          return objectValue === undefined ? sourceValue : objectValue;
        }
        function assignOwnDefaults(objectValue, sourceValue, key, object) {
          return (objectValue === undefined || !hasOwnProperty.call(object, key)) ? sourceValue : objectValue;
        }
        function assignWith(object, source, customizer) {
          var props = keys(source);
          push.apply(props, getSymbols(source));
          var index = -1,
              length = props.length;
          while (++index < length) {
            var key = props[index],
                value = object[key],
                result = customizer(value, source[key], key, object, source);
            if ((result === result ? (result !== value) : (value === value)) || (value === undefined && !(key in object))) {
              object[key] = result;
            }
          }
          return object;
        }
        var baseAssign = nativeAssign || function(object, source) {
          return source == null ? object : baseCopy(source, getSymbols(source), baseCopy(source, keys(source), object));
        };
        function baseAt(collection, props) {
          var index = -1,
              length = collection.length,
              isArr = isLength(length),
              propsLength = props.length,
              result = Array(propsLength);
          while (++index < propsLength) {
            var key = props[index];
            if (isArr) {
              result[index] = isIndex(key, length) ? collection[key] : undefined;
            } else {
              result[index] = collection[key];
            }
          }
          return result;
        }
        function baseCopy(source, props, object) {
          object || (object = {});
          var index = -1,
              length = props.length;
          while (++index < length) {
            var key = props[index];
            object[key] = source[key];
          }
          return object;
        }
        function baseCallback(func, thisArg, argCount) {
          var type = typeof func;
          if (type == 'function') {
            return thisArg === undefined ? func : bindCallback(func, thisArg, argCount);
          }
          if (func == null) {
            return identity;
          }
          if (type == 'object') {
            return baseMatches(func);
          }
          return thisArg === undefined ? property(func) : baseMatchesProperty(func, thisArg);
        }
        function baseClone(value, isDeep, customizer, key, object, stackA, stackB) {
          var result;
          if (customizer) {
            result = object ? customizer(value, key, object) : customizer(value);
          }
          if (result !== undefined) {
            return result;
          }
          if (!isObject(value)) {
            return value;
          }
          var isArr = isArray(value);
          if (isArr) {
            result = initCloneArray(value);
            if (!isDeep) {
              return arrayCopy(value, result);
            }
          } else {
            var tag = objToString.call(value),
                isFunc = tag == funcTag;
            if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
              result = initCloneObject(isFunc ? {} : value);
              if (!isDeep) {
                return baseAssign(result, value);
              }
            } else {
              return cloneableTags[tag] ? initCloneByTag(value, tag, isDeep) : (object ? value : {});
            }
          }
          stackA || (stackA = []);
          stackB || (stackB = []);
          var length = stackA.length;
          while (length--) {
            if (stackA[length] == value) {
              return stackB[length];
            }
          }
          stackA.push(value);
          stackB.push(result);
          (isArr ? arrayEach : baseForOwn)(value, function(subValue, key) {
            result[key] = baseClone(subValue, isDeep, customizer, key, value, stackA, stackB);
          });
          return result;
        }
        var baseCreate = (function() {
          function Object() {}
          return function(prototype) {
            if (isObject(prototype)) {
              Object.prototype = prototype;
              var result = new Object;
              Object.prototype = null;
            }
            return result || context.Object();
          };
        }());
        function baseDelay(func, wait, args) {
          if (typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          return setTimeout(function() {
            func.apply(undefined, args);
          }, wait);
        }
        function baseDifference(array, values) {
          var length = array ? array.length : 0,
              result = [];
          if (!length) {
            return result;
          }
          var index = -1,
              indexOf = getIndexOf(),
              isCommon = indexOf == baseIndexOf,
              cache = (isCommon && values.length >= 200) ? createCache(values) : null,
              valuesLength = values.length;
          if (cache) {
            indexOf = cacheIndexOf;
            isCommon = false;
            values = cache;
          }
          outer: while (++index < length) {
            var value = array[index];
            if (isCommon && value === value) {
              var valuesIndex = valuesLength;
              while (valuesIndex--) {
                if (values[valuesIndex] === value) {
                  continue outer;
                }
              }
              result.push(value);
            } else if (indexOf(values, value, 0) < 0) {
              result.push(value);
            }
          }
          return result;
        }
        var baseEach = createBaseEach(baseForOwn);
        var baseEachRight = createBaseEach(baseForOwnRight, true);
        function baseEvery(collection, predicate) {
          var result = true;
          baseEach(collection, function(value, index, collection) {
            result = !!predicate(value, index, collection);
            return result;
          });
          return result;
        }
        function baseFill(array, value, start, end) {
          var length = array.length;
          start = start == null ? 0 : (+start || 0);
          if (start < 0) {
            start = -start > length ? 0 : (length + start);
          }
          end = (end === undefined || end > length) ? length : (+end || 0);
          if (end < 0) {
            end += length;
          }
          length = start > end ? 0 : (end >>> 0);
          start >>>= 0;
          while (start < length) {
            array[start++] = value;
          }
          return array;
        }
        function baseFilter(collection, predicate) {
          var result = [];
          baseEach(collection, function(value, index, collection) {
            if (predicate(value, index, collection)) {
              result.push(value);
            }
          });
          return result;
        }
        function baseFind(collection, predicate, eachFunc, retKey) {
          var result;
          eachFunc(collection, function(value, key, collection) {
            if (predicate(value, key, collection)) {
              result = retKey ? key : value;
              return false;
            }
          });
          return result;
        }
        function baseFlatten(array, isDeep, isStrict) {
          var index = -1,
              length = array.length,
              resIndex = -1,
              result = [];
          while (++index < length) {
            var value = array[index];
            if (isObjectLike(value) && isLength(value.length) && (isArray(value) || isArguments(value))) {
              if (isDeep) {
                value = baseFlatten(value, isDeep, isStrict);
              }
              var valIndex = -1,
                  valLength = value.length;
              result.length += valLength;
              while (++valIndex < valLength) {
                result[++resIndex] = value[valIndex];
              }
            } else if (!isStrict) {
              result[++resIndex] = value;
            }
          }
          return result;
        }
        var baseFor = createBaseFor();
        var baseForRight = createBaseFor(true);
        function baseForIn(object, iteratee) {
          return baseFor(object, iteratee, keysIn);
        }
        function baseForOwn(object, iteratee) {
          return baseFor(object, iteratee, keys);
        }
        function baseForOwnRight(object, iteratee) {
          return baseForRight(object, iteratee, keys);
        }
        function baseFunctions(object, props) {
          var index = -1,
              length = props.length,
              resIndex = -1,
              result = [];
          while (++index < length) {
            var key = props[index];
            if (isFunction(object[key])) {
              result[++resIndex] = key;
            }
          }
          return result;
        }
        function baseGet(object, path, pathKey) {
          if (object == null) {
            return ;
          }
          if (pathKey !== undefined && pathKey in toObject(object)) {
            path = [pathKey];
          }
          var index = -1,
              length = path.length;
          while (object != null && ++index < length) {
            var result = object = object[path[index]];
          }
          return result;
        }
        function baseIsEqual(value, other, customizer, isLoose, stackA, stackB) {
          if (value === other) {
            return value !== 0 || (1 / value == 1 / other);
          }
          var valType = typeof value,
              othType = typeof other;
          if ((valType != 'function' && valType != 'object' && othType != 'function' && othType != 'object') || value == null || other == null) {
            return value !== value && other !== other;
          }
          return baseIsEqualDeep(value, other, baseIsEqual, customizer, isLoose, stackA, stackB);
        }
        function baseIsEqualDeep(object, other, equalFunc, customizer, isLoose, stackA, stackB) {
          var objIsArr = isArray(object),
              othIsArr = isArray(other),
              objTag = arrayTag,
              othTag = arrayTag;
          if (!objIsArr) {
            objTag = objToString.call(object);
            if (objTag == argsTag) {
              objTag = objectTag;
            } else if (objTag != objectTag) {
              objIsArr = isTypedArray(object);
            }
          }
          if (!othIsArr) {
            othTag = objToString.call(other);
            if (othTag == argsTag) {
              othTag = objectTag;
            } else if (othTag != objectTag) {
              othIsArr = isTypedArray(other);
            }
          }
          var objIsObj = objTag == objectTag,
              othIsObj = othTag == objectTag,
              isSameTag = objTag == othTag;
          if (isSameTag && !(objIsArr || objIsObj)) {
            return equalByTag(object, other, objTag);
          }
          if (!isLoose) {
            var valWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
                othWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');
            if (valWrapped || othWrapped) {
              return equalFunc(valWrapped ? object.value() : object, othWrapped ? other.value() : other, customizer, isLoose, stackA, stackB);
            }
          }
          if (!isSameTag) {
            return false;
          }
          stackA || (stackA = []);
          stackB || (stackB = []);
          var length = stackA.length;
          while (length--) {
            if (stackA[length] == object) {
              return stackB[length] == other;
            }
          }
          stackA.push(object);
          stackB.push(other);
          var result = (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, isLoose, stackA, stackB);
          stackA.pop();
          stackB.pop();
          return result;
        }
        function baseIsMatch(object, props, values, strictCompareFlags, customizer) {
          var index = -1,
              length = props.length,
              noCustomizer = !customizer;
          while (++index < length) {
            if ((noCustomizer && strictCompareFlags[index]) ? values[index] !== object[props[index]] : !(props[index] in object)) {
              return false;
            }
          }
          index = -1;
          while (++index < length) {
            var key = props[index],
                objValue = object[key],
                srcValue = values[index];
            if (noCustomizer && strictCompareFlags[index]) {
              var result = objValue !== undefined || (key in object);
            } else {
              result = customizer ? customizer(objValue, srcValue, key) : undefined;
              if (result === undefined) {
                result = baseIsEqual(srcValue, objValue, customizer, true);
              }
            }
            if (!result) {
              return false;
            }
          }
          return true;
        }
        function baseMap(collection, iteratee) {
          var index = -1,
              length = getLength(collection),
              result = isLength(length) ? Array(length) : [];
          baseEach(collection, function(value, key, collection) {
            result[++index] = iteratee(value, key, collection);
          });
          return result;
        }
        function baseMatches(source) {
          var props = keys(source),
              length = props.length;
          if (!length) {
            return constant(true);
          }
          if (length == 1) {
            var key = props[0],
                value = source[key];
            if (isStrictComparable(value)) {
              return function(object) {
                if (object == null) {
                  return false;
                }
                return object[key] === value && (value !== undefined || (key in toObject(object)));
              };
            }
          }
          var values = Array(length),
              strictCompareFlags = Array(length);
          while (length--) {
            value = source[props[length]];
            values[length] = value;
            strictCompareFlags[length] = isStrictComparable(value);
          }
          return function(object) {
            return object != null && baseIsMatch(toObject(object), props, values, strictCompareFlags);
          };
        }
        function baseMatchesProperty(path, value) {
          var isArr = isArray(path),
              isCommon = isKey(path) && isStrictComparable(value),
              pathKey = (path + '');
          path = toPath(path);
          return function(object) {
            if (object == null) {
              return false;
            }
            var key = pathKey;
            object = toObject(object);
            if ((isArr || !isCommon) && !(key in object)) {
              object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
              if (object == null) {
                return false;
              }
              key = last(path);
              object = toObject(object);
            }
            return object[key] === value ? (value !== undefined || (key in object)) : baseIsEqual(value, object[key], null, true);
          };
        }
        function baseMerge(object, source, customizer, stackA, stackB) {
          if (!isObject(object)) {
            return object;
          }
          var isSrcArr = isLength(source.length) && (isArray(source) || isTypedArray(source));
          if (!isSrcArr) {
            var props = keys(source);
            push.apply(props, getSymbols(source));
          }
          arrayEach(props || source, function(srcValue, key) {
            if (props) {
              key = srcValue;
              srcValue = source[key];
            }
            if (isObjectLike(srcValue)) {
              stackA || (stackA = []);
              stackB || (stackB = []);
              baseMergeDeep(object, source, key, baseMerge, customizer, stackA, stackB);
            } else {
              var value = object[key],
                  result = customizer ? customizer(value, srcValue, key, object, source) : undefined,
                  isCommon = result === undefined;
              if (isCommon) {
                result = srcValue;
              }
              if ((isSrcArr || result !== undefined) && (isCommon || (result === result ? (result !== value) : (value === value)))) {
                object[key] = result;
              }
            }
          });
          return object;
        }
        function baseMergeDeep(object, source, key, mergeFunc, customizer, stackA, stackB) {
          var length = stackA.length,
              srcValue = source[key];
          while (length--) {
            if (stackA[length] == srcValue) {
              object[key] = stackB[length];
              return ;
            }
          }
          var value = object[key],
              result = customizer ? customizer(value, srcValue, key, object, source) : undefined,
              isCommon = result === undefined;
          if (isCommon) {
            result = srcValue;
            if (isLength(srcValue.length) && (isArray(srcValue) || isTypedArray(srcValue))) {
              result = isArray(value) ? value : (getLength(value) ? arrayCopy(value) : []);
            } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
              result = isArguments(value) ? toPlainObject(value) : (isPlainObject(value) ? value : {});
            } else {
              isCommon = false;
            }
          }
          stackA.push(srcValue);
          stackB.push(result);
          if (isCommon) {
            object[key] = mergeFunc(result, srcValue, customizer, stackA, stackB);
          } else if (result === result ? (result !== value) : (value === value)) {
            object[key] = result;
          }
        }
        function baseProperty(key) {
          return function(object) {
            return object == null ? undefined : object[key];
          };
        }
        function basePropertyDeep(path) {
          var pathKey = (path + '');
          path = toPath(path);
          return function(object) {
            return baseGet(object, path, pathKey);
          };
        }
        function basePullAt(array, indexes) {
          var length = indexes.length;
          while (length--) {
            var index = parseFloat(indexes[length]);
            if (index != previous && isIndex(index)) {
              var previous = index;
              splice.call(array, index, 1);
            }
          }
          return array;
        }
        function baseRandom(min, max) {
          return min + floor(nativeRandom() * (max - min + 1));
        }
        function baseReduce(collection, iteratee, accumulator, initFromCollection, eachFunc) {
          eachFunc(collection, function(value, index, collection) {
            accumulator = initFromCollection ? (initFromCollection = false, value) : iteratee(accumulator, value, index, collection);
          });
          return accumulator;
        }
        var baseSetData = !metaMap ? identity : function(func, data) {
          metaMap.set(func, data);
          return func;
        };
        function baseSlice(array, start, end) {
          var index = -1,
              length = array.length;
          start = start == null ? 0 : (+start || 0);
          if (start < 0) {
            start = -start > length ? 0 : (length + start);
          }
          end = (end === undefined || end > length) ? length : (+end || 0);
          if (end < 0) {
            end += length;
          }
          length = start > end ? 0 : ((end - start) >>> 0);
          start >>>= 0;
          var result = Array(length);
          while (++index < length) {
            result[index] = array[index + start];
          }
          return result;
        }
        function baseSome(collection, predicate) {
          var result;
          baseEach(collection, function(value, index, collection) {
            result = predicate(value, index, collection);
            return !result;
          });
          return !!result;
        }
        function baseSortBy(array, comparer) {
          var length = array.length;
          array.sort(comparer);
          while (length--) {
            array[length] = array[length].value;
          }
          return array;
        }
        function baseSortByOrder(collection, iteratees, orders) {
          var callback = getCallback(),
              index = -1;
          iteratees = arrayMap(iteratees, function(iteratee) {
            return callback(iteratee);
          });
          var result = baseMap(collection, function(value) {
            var criteria = arrayMap(iteratees, function(iteratee) {
              return iteratee(value);
            });
            return {
              'criteria': criteria,
              'index': ++index,
              'value': value
            };
          });
          return baseSortBy(result, function(object, other) {
            return compareMultiple(object, other, orders);
          });
        }
        function baseSum(collection, iteratee) {
          var result = 0;
          baseEach(collection, function(value, index, collection) {
            result += +iteratee(value, index, collection) || 0;
          });
          return result;
        }
        function baseUniq(array, iteratee) {
          var index = -1,
              indexOf = getIndexOf(),
              length = array.length,
              isCommon = indexOf == baseIndexOf,
              isLarge = isCommon && length >= 200,
              seen = isLarge ? createCache() : null,
              result = [];
          if (seen) {
            indexOf = cacheIndexOf;
            isCommon = false;
          } else {
            isLarge = false;
            seen = iteratee ? [] : result;
          }
          outer: while (++index < length) {
            var value = array[index],
                computed = iteratee ? iteratee(value, index, array) : value;
            if (isCommon && value === value) {
              var seenIndex = seen.length;
              while (seenIndex--) {
                if (seen[seenIndex] === computed) {
                  continue outer;
                }
              }
              if (iteratee) {
                seen.push(computed);
              }
              result.push(value);
            } else if (indexOf(seen, computed, 0) < 0) {
              if (iteratee || isLarge) {
                seen.push(computed);
              }
              result.push(value);
            }
          }
          return result;
        }
        function baseValues(object, props) {
          var index = -1,
              length = props.length,
              result = Array(length);
          while (++index < length) {
            result[index] = object[props[index]];
          }
          return result;
        }
        function baseWhile(array, predicate, isDrop, fromRight) {
          var length = array.length,
              index = fromRight ? length : -1;
          while ((fromRight ? index-- : ++index < length) && predicate(array[index], index, array)) {}
          return isDrop ? baseSlice(array, (fromRight ? 0 : index), (fromRight ? index + 1 : length)) : baseSlice(array, (fromRight ? index + 1 : 0), (fromRight ? length : index));
        }
        function baseWrapperValue(value, actions) {
          var result = value;
          if (result instanceof LazyWrapper) {
            result = result.value();
          }
          var index = -1,
              length = actions.length;
          while (++index < length) {
            var args = [result],
                action = actions[index];
            push.apply(args, action.args);
            result = action.func.apply(action.thisArg, args);
          }
          return result;
        }
        function binaryIndex(array, value, retHighest) {
          var low = 0,
              high = array ? array.length : low;
          if (typeof value == 'number' && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
            while (low < high) {
              var mid = (low + high) >>> 1,
                  computed = array[mid];
              if (retHighest ? (computed <= value) : (computed < value)) {
                low = mid + 1;
              } else {
                high = mid;
              }
            }
            return high;
          }
          return binaryIndexBy(array, value, identity, retHighest);
        }
        function binaryIndexBy(array, value, iteratee, retHighest) {
          value = iteratee(value);
          var low = 0,
              high = array ? array.length : 0,
              valIsNaN = value !== value,
              valIsUndef = value === undefined;
          while (low < high) {
            var mid = floor((low + high) / 2),
                computed = iteratee(array[mid]),
                isReflexive = computed === computed;
            if (valIsNaN) {
              var setLow = isReflexive || retHighest;
            } else if (valIsUndef) {
              setLow = isReflexive && (retHighest || computed !== undefined);
            } else {
              setLow = retHighest ? (computed <= value) : (computed < value);
            }
            if (setLow) {
              low = mid + 1;
            } else {
              high = mid;
            }
          }
          return nativeMin(high, MAX_ARRAY_INDEX);
        }
        function bindCallback(func, thisArg, argCount) {
          if (typeof func != 'function') {
            return identity;
          }
          if (thisArg === undefined) {
            return func;
          }
          switch (argCount) {
            case 1:
              return function(value) {
                return func.call(thisArg, value);
              };
            case 3:
              return function(value, index, collection) {
                return func.call(thisArg, value, index, collection);
              };
            case 4:
              return function(accumulator, value, index, collection) {
                return func.call(thisArg, accumulator, value, index, collection);
              };
            case 5:
              return function(value, other, key, object, source) {
                return func.call(thisArg, value, other, key, object, source);
              };
          }
          return function() {
            return func.apply(thisArg, arguments);
          };
        }
        function bufferClone(buffer) {
          return bufferSlice.call(buffer, 0);
        }
        if (!bufferSlice) {
          bufferClone = !(ArrayBuffer && Uint8Array) ? constant(null) : function(buffer) {
            var byteLength = buffer.byteLength,
                floatLength = Float64Array ? floor(byteLength / FLOAT64_BYTES_PER_ELEMENT) : 0,
                offset = floatLength * FLOAT64_BYTES_PER_ELEMENT,
                result = new ArrayBuffer(byteLength);
            if (floatLength) {
              var view = new Float64Array(result, 0, floatLength);
              view.set(new Float64Array(buffer, 0, floatLength));
            }
            if (byteLength != offset) {
              view = new Uint8Array(result, offset);
              view.set(new Uint8Array(buffer, offset));
            }
            return result;
          };
        }
        function composeArgs(args, partials, holders) {
          var holdersLength = holders.length,
              argsIndex = -1,
              argsLength = nativeMax(args.length - holdersLength, 0),
              leftIndex = -1,
              leftLength = partials.length,
              result = Array(argsLength + leftLength);
          while (++leftIndex < leftLength) {
            result[leftIndex] = partials[leftIndex];
          }
          while (++argsIndex < holdersLength) {
            result[holders[argsIndex]] = args[argsIndex];
          }
          while (argsLength--) {
            result[leftIndex++] = args[argsIndex++];
          }
          return result;
        }
        function composeArgsRight(args, partials, holders) {
          var holdersIndex = -1,
              holdersLength = holders.length,
              argsIndex = -1,
              argsLength = nativeMax(args.length - holdersLength, 0),
              rightIndex = -1,
              rightLength = partials.length,
              result = Array(argsLength + rightLength);
          while (++argsIndex < argsLength) {
            result[argsIndex] = args[argsIndex];
          }
          var pad = argsIndex;
          while (++rightIndex < rightLength) {
            result[pad + rightIndex] = partials[rightIndex];
          }
          while (++holdersIndex < holdersLength) {
            result[pad + holders[holdersIndex]] = args[argsIndex++];
          }
          return result;
        }
        function createAggregator(setter, initializer) {
          return function(collection, iteratee, thisArg) {
            var result = initializer ? initializer() : {};
            iteratee = getCallback(iteratee, thisArg, 3);
            if (isArray(collection)) {
              var index = -1,
                  length = collection.length;
              while (++index < length) {
                var value = collection[index];
                setter(result, value, iteratee(value, index, collection), collection);
              }
            } else {
              baseEach(collection, function(value, key, collection) {
                setter(result, value, iteratee(value, key, collection), collection);
              });
            }
            return result;
          };
        }
        function createAssigner(assigner) {
          return restParam(function(object, sources) {
            var index = -1,
                length = object == null ? 0 : sources.length,
                customizer = length > 2 && sources[length - 2],
                guard = length > 2 && sources[2],
                thisArg = length > 1 && sources[length - 1];
            if (typeof customizer == 'function') {
              customizer = bindCallback(customizer, thisArg, 5);
              length -= 2;
            } else {
              customizer = typeof thisArg == 'function' ? thisArg : null;
              length -= (customizer ? 1 : 0);
            }
            if (guard && isIterateeCall(sources[0], sources[1], guard)) {
              customizer = length < 3 ? null : customizer;
              length = 1;
            }
            while (++index < length) {
              var source = sources[index];
              if (source) {
                assigner(object, source, customizer);
              }
            }
            return object;
          });
        }
        function createBaseEach(eachFunc, fromRight) {
          return function(collection, iteratee) {
            var length = collection ? getLength(collection) : 0;
            if (!isLength(length)) {
              return eachFunc(collection, iteratee);
            }
            var index = fromRight ? length : -1,
                iterable = toObject(collection);
            while ((fromRight ? index-- : ++index < length)) {
              if (iteratee(iterable[index], index, iterable) === false) {
                break;
              }
            }
            return collection;
          };
        }
        function createBaseFor(fromRight) {
          return function(object, iteratee, keysFunc) {
            var iterable = toObject(object),
                props = keysFunc(object),
                length = props.length,
                index = fromRight ? length : -1;
            while ((fromRight ? index-- : ++index < length)) {
              var key = props[index];
              if (iteratee(iterable[key], key, iterable) === false) {
                break;
              }
            }
            return object;
          };
        }
        function createBindWrapper(func, thisArg) {
          var Ctor = createCtorWrapper(func);
          function wrapper() {
            var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
            return fn.apply(thisArg, arguments);
          }
          return wrapper;
        }
        var createCache = !(nativeCreate && Set) ? constant(null) : function(values) {
          return new SetCache(values);
        };
        function createCompounder(callback) {
          return function(string) {
            var index = -1,
                array = words(deburr(string)),
                length = array.length,
                result = '';
            while (++index < length) {
              result = callback(result, array[index], index);
            }
            return result;
          };
        }
        function createCtorWrapper(Ctor) {
          return function() {
            var thisBinding = baseCreate(Ctor.prototype),
                result = Ctor.apply(thisBinding, arguments);
            return isObject(result) ? result : thisBinding;
          };
        }
        function createCurry(flag) {
          function curryFunc(func, arity, guard) {
            if (guard && isIterateeCall(func, arity, guard)) {
              arity = null;
            }
            var result = createWrapper(func, flag, null, null, null, null, null, arity);
            result.placeholder = curryFunc.placeholder;
            return result;
          }
          return curryFunc;
        }
        function createExtremum(arrayFunc, isMin) {
          return function(collection, iteratee, thisArg) {
            if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
              iteratee = null;
            }
            var func = getCallback(),
                noIteratee = iteratee == null;
            if (!(func === baseCallback && noIteratee)) {
              noIteratee = false;
              iteratee = func(iteratee, thisArg, 3);
            }
            if (noIteratee) {
              var isArr = isArray(collection);
              if (!isArr && isString(collection)) {
                iteratee = charAtCallback;
              } else {
                return arrayFunc(isArr ? collection : toIterable(collection));
              }
            }
            return extremumBy(collection, iteratee, isMin);
          };
        }
        function createFind(eachFunc, fromRight) {
          return function(collection, predicate, thisArg) {
            predicate = getCallback(predicate, thisArg, 3);
            if (isArray(collection)) {
              var index = baseFindIndex(collection, predicate, fromRight);
              return index > -1 ? collection[index] : undefined;
            }
            return baseFind(collection, predicate, eachFunc);
          };
        }
        function createFindIndex(fromRight) {
          return function(array, predicate, thisArg) {
            if (!(array && array.length)) {
              return -1;
            }
            predicate = getCallback(predicate, thisArg, 3);
            return baseFindIndex(array, predicate, fromRight);
          };
        }
        function createFindKey(objectFunc) {
          return function(object, predicate, thisArg) {
            predicate = getCallback(predicate, thisArg, 3);
            return baseFind(object, predicate, objectFunc, true);
          };
        }
        function createFlow(fromRight) {
          return function() {
            var length = arguments.length;
            if (!length) {
              return function() {
                return arguments[0];
              };
            }
            var wrapper,
                index = fromRight ? length : -1,
                leftIndex = 0,
                funcs = Array(length);
            while ((fromRight ? index-- : ++index < length)) {
              var func = funcs[leftIndex++] = arguments[index];
              if (typeof func != 'function') {
                throw new TypeError(FUNC_ERROR_TEXT);
              }
              var funcName = wrapper ? '' : getFuncName(func);
              wrapper = funcName == 'wrapper' ? new LodashWrapper([]) : wrapper;
            }
            index = wrapper ? -1 : length;
            while (++index < length) {
              func = funcs[index];
              funcName = getFuncName(func);
              var data = funcName == 'wrapper' ? getData(func) : null;
              if (data && isLaziable(data[0])) {
                wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
              } else {
                wrapper = (func.length == 1 && isLaziable(func)) ? wrapper[funcName]() : wrapper.thru(func);
              }
            }
            return function() {
              var args = arguments;
              if (wrapper && args.length == 1 && isArray(args[0])) {
                return wrapper.plant(args[0]).value();
              }
              var index = 0,
                  result = funcs[index].apply(this, args);
              while (++index < length) {
                result = funcs[index].call(this, result);
              }
              return result;
            };
          };
        }
        function createForEach(arrayFunc, eachFunc) {
          return function(collection, iteratee, thisArg) {
            return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection)) ? arrayFunc(collection, iteratee) : eachFunc(collection, bindCallback(iteratee, thisArg, 3));
          };
        }
        function createForIn(objectFunc) {
          return function(object, iteratee, thisArg) {
            if (typeof iteratee != 'function' || thisArg !== undefined) {
              iteratee = bindCallback(iteratee, thisArg, 3);
            }
            return objectFunc(object, iteratee, keysIn);
          };
        }
        function createForOwn(objectFunc) {
          return function(object, iteratee, thisArg) {
            if (typeof iteratee != 'function' || thisArg !== undefined) {
              iteratee = bindCallback(iteratee, thisArg, 3);
            }
            return objectFunc(object, iteratee);
          };
        }
        function createPadDir(fromRight) {
          return function(string, length, chars) {
            string = baseToString(string);
            return string && ((fromRight ? string : '') + createPadding(string, length, chars) + (fromRight ? '' : string));
          };
        }
        function createPartial(flag) {
          var partialFunc = restParam(function(func, partials) {
            var holders = replaceHolders(partials, partialFunc.placeholder);
            return createWrapper(func, flag, null, partials, holders);
          });
          return partialFunc;
        }
        function createReduce(arrayFunc, eachFunc) {
          return function(collection, iteratee, accumulator, thisArg) {
            var initFromArray = arguments.length < 3;
            return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection)) ? arrayFunc(collection, iteratee, accumulator, initFromArray) : baseReduce(collection, getCallback(iteratee, thisArg, 4), accumulator, initFromArray, eachFunc);
          };
        }
        function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
          var isAry = bitmask & ARY_FLAG,
              isBind = bitmask & BIND_FLAG,
              isBindKey = bitmask & BIND_KEY_FLAG,
              isCurry = bitmask & CURRY_FLAG,
              isCurryBound = bitmask & CURRY_BOUND_FLAG,
              isCurryRight = bitmask & CURRY_RIGHT_FLAG;
          var Ctor = !isBindKey && createCtorWrapper(func),
              key = func;
          function wrapper() {
            var length = arguments.length,
                index = length,
                args = Array(length);
            while (index--) {
              args[index] = arguments[index];
            }
            if (partials) {
              args = composeArgs(args, partials, holders);
            }
            if (partialsRight) {
              args = composeArgsRight(args, partialsRight, holdersRight);
            }
            if (isCurry || isCurryRight) {
              var placeholder = wrapper.placeholder,
                  argsHolders = replaceHolders(args, placeholder);
              length -= argsHolders.length;
              if (length < arity) {
                var newArgPos = argPos ? arrayCopy(argPos) : null,
                    newArity = nativeMax(arity - length, 0),
                    newsHolders = isCurry ? argsHolders : null,
                    newHoldersRight = isCurry ? null : argsHolders,
                    newPartials = isCurry ? args : null,
                    newPartialsRight = isCurry ? null : args;
                bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
                bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);
                if (!isCurryBound) {
                  bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
                }
                var newData = [func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, newArity],
                    result = createHybridWrapper.apply(undefined, newData);
                if (isLaziable(func)) {
                  setData(result, newData);
                }
                result.placeholder = placeholder;
                return result;
              }
            }
            var thisBinding = isBind ? thisArg : this;
            if (isBindKey) {
              func = thisBinding[key];
            }
            if (argPos) {
              args = reorder(args, argPos);
            }
            if (isAry && ary < args.length) {
              args.length = ary;
            }
            var fn = (this && this !== root && this instanceof wrapper) ? (Ctor || createCtorWrapper(func)) : func;
            return fn.apply(thisBinding, args);
          }
          return wrapper;
        }
        function createPadding(string, length, chars) {
          var strLength = string.length;
          length = +length;
          if (strLength >= length || !nativeIsFinite(length)) {
            return '';
          }
          var padLength = length - strLength;
          chars = chars == null ? ' ' : (chars + '');
          return repeat(chars, ceil(padLength / chars.length)).slice(0, padLength);
        }
        function createPartialWrapper(func, bitmask, thisArg, partials) {
          var isBind = bitmask & BIND_FLAG,
              Ctor = createCtorWrapper(func);
          function wrapper() {
            var argsIndex = -1,
                argsLength = arguments.length,
                leftIndex = -1,
                leftLength = partials.length,
                args = Array(argsLength + leftLength);
            while (++leftIndex < leftLength) {
              args[leftIndex] = partials[leftIndex];
            }
            while (argsLength--) {
              args[leftIndex++] = arguments[++argsIndex];
            }
            var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
            return fn.apply(isBind ? thisArg : this, args);
          }
          return wrapper;
        }
        function createSortedIndex(retHighest) {
          return function(array, value, iteratee, thisArg) {
            var func = getCallback(iteratee);
            return (func === baseCallback && iteratee == null) ? binaryIndex(array, value, retHighest) : binaryIndexBy(array, value, func(iteratee, thisArg, 1), retHighest);
          };
        }
        function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
          var isBindKey = bitmask & BIND_KEY_FLAG;
          if (!isBindKey && typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          var length = partials ? partials.length : 0;
          if (!length) {
            bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
            partials = holders = null;
          }
          length -= (holders ? holders.length : 0);
          if (bitmask & PARTIAL_RIGHT_FLAG) {
            var partialsRight = partials,
                holdersRight = holders;
            partials = holders = null;
          }
          var data = isBindKey ? null : getData(func),
              newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];
          if (data) {
            mergeData(newData, data);
            bitmask = newData[1];
            arity = newData[9];
          }
          newData[9] = arity == null ? (isBindKey ? 0 : func.length) : (nativeMax(arity - length, 0) || 0);
          if (bitmask == BIND_FLAG) {
            var result = createBindWrapper(newData[0], newData[2]);
          } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !newData[4].length) {
            result = createPartialWrapper.apply(undefined, newData);
          } else {
            result = createHybridWrapper.apply(undefined, newData);
          }
          var setter = data ? baseSetData : setData;
          return setter(result, newData);
        }
        function equalArrays(array, other, equalFunc, customizer, isLoose, stackA, stackB) {
          var index = -1,
              arrLength = array.length,
              othLength = other.length,
              result = true;
          if (arrLength != othLength && !(isLoose && othLength > arrLength)) {
            return false;
          }
          while (result && ++index < arrLength) {
            var arrValue = array[index],
                othValue = other[index];
            result = undefined;
            if (customizer) {
              result = isLoose ? customizer(othValue, arrValue, index) : customizer(arrValue, othValue, index);
            }
            if (result === undefined) {
              if (isLoose) {
                var othIndex = othLength;
                while (othIndex--) {
                  othValue = other[othIndex];
                  result = (arrValue && arrValue === othValue) || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB);
                  if (result) {
                    break;
                  }
                }
              } else {
                result = (arrValue && arrValue === othValue) || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB);
              }
            }
          }
          return !!result;
        }
        function equalByTag(object, other, tag) {
          switch (tag) {
            case boolTag:
            case dateTag:
              return +object == +other;
            case errorTag:
              return object.name == other.name && object.message == other.message;
            case numberTag:
              return (object != +object) ? other != +other : (object == 0 ? ((1 / object) == (1 / other)) : object == +other);
            case regexpTag:
            case stringTag:
              return object == (other + '');
          }
          return false;
        }
        function equalObjects(object, other, equalFunc, customizer, isLoose, stackA, stackB) {
          var objProps = keys(object),
              objLength = objProps.length,
              othProps = keys(other),
              othLength = othProps.length;
          if (objLength != othLength && !isLoose) {
            return false;
          }
          var skipCtor = isLoose,
              index = -1;
          while (++index < objLength) {
            var key = objProps[index],
                result = isLoose ? key in other : hasOwnProperty.call(other, key);
            if (result) {
              var objValue = object[key],
                  othValue = other[key];
              result = undefined;
              if (customizer) {
                result = isLoose ? customizer(othValue, objValue, key) : customizer(objValue, othValue, key);
              }
              if (result === undefined) {
                result = (objValue && objValue === othValue) || equalFunc(objValue, othValue, customizer, isLoose, stackA, stackB);
              }
            }
            if (!result) {
              return false;
            }
            skipCtor || (skipCtor = key == 'constructor');
          }
          if (!skipCtor) {
            var objCtor = object.constructor,
                othCtor = other.constructor;
            if (objCtor != othCtor && ('constructor' in object && 'constructor' in other) && !(typeof objCtor == 'function' && objCtor instanceof objCtor && typeof othCtor == 'function' && othCtor instanceof othCtor)) {
              return false;
            }
          }
          return true;
        }
        function extremumBy(collection, iteratee, isMin) {
          var exValue = isMin ? POSITIVE_INFINITY : NEGATIVE_INFINITY,
              computed = exValue,
              result = computed;
          baseEach(collection, function(value, index, collection) {
            var current = iteratee(value, index, collection);
            if ((isMin ? (current < computed) : (current > computed)) || (current === exValue && current === result)) {
              computed = current;
              result = value;
            }
          });
          return result;
        }
        function getCallback(func, thisArg, argCount) {
          var result = lodash.callback || callback;
          result = result === callback ? baseCallback : result;
          return argCount ? result(func, thisArg, argCount) : result;
        }
        var getData = !metaMap ? noop : function(func) {
          return metaMap.get(func);
        };
        var getFuncName = (function() {
          if (!support.funcNames) {
            return constant('');
          }
          if (constant.name == 'constant') {
            return baseProperty('name');
          }
          return function(func) {
            var result = func.name,
                array = realNames[result],
                length = array ? array.length : 0;
            while (length--) {
              var data = array[length],
                  otherFunc = data.func;
              if (otherFunc == null || otherFunc == func) {
                return data.name;
              }
            }
            return result;
          };
        }());
        function getIndexOf(collection, target, fromIndex) {
          var result = lodash.indexOf || indexOf;
          result = result === indexOf ? baseIndexOf : result;
          return collection ? result(collection, target, fromIndex) : result;
        }
        var getLength = baseProperty('length');
        var getSymbols = !getOwnPropertySymbols ? constant([]) : function(object) {
          return getOwnPropertySymbols(toObject(object));
        };
        function getView(start, end, transforms) {
          var index = -1,
              length = transforms ? transforms.length : 0;
          while (++index < length) {
            var data = transforms[index],
                size = data.size;
            switch (data.type) {
              case 'drop':
                start += size;
                break;
              case 'dropRight':
                end -= size;
                break;
              case 'take':
                end = nativeMin(end, start + size);
                break;
              case 'takeRight':
                start = nativeMax(start, end - size);
                break;
            }
          }
          return {
            'start': start,
            'end': end
          };
        }
        function initCloneArray(array) {
          var length = array.length,
              result = new array.constructor(length);
          if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
            result.index = array.index;
            result.input = array.input;
          }
          return result;
        }
        function initCloneObject(object) {
          var Ctor = object.constructor;
          if (!(typeof Ctor == 'function' && Ctor instanceof Ctor)) {
            Ctor = Object;
          }
          return new Ctor;
        }
        function initCloneByTag(object, tag, isDeep) {
          var Ctor = object.constructor;
          switch (tag) {
            case arrayBufferTag:
              return bufferClone(object);
            case boolTag:
            case dateTag:
              return new Ctor(+object);
            case float32Tag:
            case float64Tag:
            case int8Tag:
            case int16Tag:
            case int32Tag:
            case uint8Tag:
            case uint8ClampedTag:
            case uint16Tag:
            case uint32Tag:
              var buffer = object.buffer;
              return new Ctor(isDeep ? bufferClone(buffer) : buffer, object.byteOffset, object.length);
            case numberTag:
            case stringTag:
              return new Ctor(object);
            case regexpTag:
              var result = new Ctor(object.source, reFlags.exec(object));
              result.lastIndex = object.lastIndex;
          }
          return result;
        }
        function invokePath(object, path, args) {
          if (object != null && !isKey(path, object)) {
            path = toPath(path);
            object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
            path = last(path);
          }
          var func = object == null ? object : object[path];
          return func == null ? undefined : func.apply(object, args);
        }
        function isIndex(value, length) {
          value = +value;
          length = length == null ? MAX_SAFE_INTEGER : length;
          return value > -1 && value % 1 == 0 && value < length;
        }
        function isIterateeCall(value, index, object) {
          if (!isObject(object)) {
            return false;
          }
          var type = typeof index;
          if (type == 'number') {
            var length = getLength(object),
                prereq = isLength(length) && isIndex(index, length);
          } else {
            prereq = type == 'string' && index in object;
          }
          if (prereq) {
            var other = object[index];
            return value === value ? (value === other) : (other !== other);
          }
          return false;
        }
        function isKey(value, object) {
          var type = typeof value;
          if ((type == 'string' && reIsPlainProp.test(value)) || type == 'number') {
            return true;
          }
          if (isArray(value)) {
            return false;
          }
          var result = !reIsDeepProp.test(value);
          return result || (object != null && value in toObject(object));
        }
        function isLaziable(func) {
          var funcName = getFuncName(func);
          return !!funcName && func === lodash[funcName] && funcName in LazyWrapper.prototype;
        }
        function isLength(value) {
          return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
        }
        function isStrictComparable(value) {
          return value === value && (value === 0 ? ((1 / value) > 0) : !isObject(value));
        }
        function mergeData(data, source) {
          var bitmask = data[1],
              srcBitmask = source[1],
              newBitmask = bitmask | srcBitmask,
              isCommon = newBitmask < ARY_FLAG;
          var isCombo = (srcBitmask == ARY_FLAG && bitmask == CURRY_FLAG) || (srcBitmask == ARY_FLAG && bitmask == REARG_FLAG && data[7].length <= source[8]) || (srcBitmask == (ARY_FLAG | REARG_FLAG) && bitmask == CURRY_FLAG);
          if (!(isCommon || isCombo)) {
            return data;
          }
          if (srcBitmask & BIND_FLAG) {
            data[2] = source[2];
            newBitmask |= (bitmask & BIND_FLAG) ? 0 : CURRY_BOUND_FLAG;
          }
          var value = source[3];
          if (value) {
            var partials = data[3];
            data[3] = partials ? composeArgs(partials, value, source[4]) : arrayCopy(value);
            data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : arrayCopy(source[4]);
          }
          value = source[5];
          if (value) {
            partials = data[5];
            data[5] = partials ? composeArgsRight(partials, value, source[6]) : arrayCopy(value);
            data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : arrayCopy(source[6]);
          }
          value = source[7];
          if (value) {
            data[7] = arrayCopy(value);
          }
          if (srcBitmask & ARY_FLAG) {
            data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
          }
          if (data[9] == null) {
            data[9] = source[9];
          }
          data[0] = source[0];
          data[1] = newBitmask;
          return data;
        }
        function pickByArray(object, props) {
          object = toObject(object);
          var index = -1,
              length = props.length,
              result = {};
          while (++index < length) {
            var key = props[index];
            if (key in object) {
              result[key] = object[key];
            }
          }
          return result;
        }
        function pickByCallback(object, predicate) {
          var result = {};
          baseForIn(object, function(value, key, object) {
            if (predicate(value, key, object)) {
              result[key] = value;
            }
          });
          return result;
        }
        function reorder(array, indexes) {
          var arrLength = array.length,
              length = nativeMin(indexes.length, arrLength),
              oldArray = arrayCopy(array);
          while (length--) {
            var index = indexes[length];
            array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
          }
          return array;
        }
        var setData = (function() {
          var count = 0,
              lastCalled = 0;
          return function(key, value) {
            var stamp = now(),
                remaining = HOT_SPAN - (stamp - lastCalled);
            lastCalled = stamp;
            if (remaining > 0) {
              if (++count >= HOT_COUNT) {
                return key;
              }
            } else {
              count = 0;
            }
            return baseSetData(key, value);
          };
        }());
        function shimIsPlainObject(value) {
          var Ctor,
              support = lodash.support;
          if (!(isObjectLike(value) && objToString.call(value) == objectTag) || (!hasOwnProperty.call(value, 'constructor') && (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
            return false;
          }
          var result;
          baseForIn(value, function(subValue, key) {
            result = key;
          });
          return result === undefined || hasOwnProperty.call(value, result);
        }
        function shimKeys(object) {
          var props = keysIn(object),
              propsLength = props.length,
              length = propsLength && object.length,
              support = lodash.support;
          var allowIndexes = length && isLength(length) && (isArray(object) || (support.nonEnumArgs && isArguments(object)));
          var index = -1,
              result = [];
          while (++index < propsLength) {
            var key = props[index];
            if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
              result.push(key);
            }
          }
          return result;
        }
        function toIterable(value) {
          if (value == null) {
            return [];
          }
          if (!isLength(getLength(value))) {
            return values(value);
          }
          return isObject(value) ? value : Object(value);
        }
        function toObject(value) {
          return isObject(value) ? value : Object(value);
        }
        function toPath(value) {
          if (isArray(value)) {
            return value;
          }
          var result = [];
          baseToString(value).replace(rePropName, function(match, number, quote, string) {
            result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
          });
          return result;
        }
        function wrapperClone(wrapper) {
          return wrapper instanceof LazyWrapper ? wrapper.clone() : new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__, arrayCopy(wrapper.__actions__));
        }
        function chunk(array, size, guard) {
          if (guard ? isIterateeCall(array, size, guard) : size == null) {
            size = 1;
          } else {
            size = nativeMax(+size || 1, 1);
          }
          var index = 0,
              length = array ? array.length : 0,
              resIndex = -1,
              result = Array(ceil(length / size));
          while (index < length) {
            result[++resIndex] = baseSlice(array, index, (index += size));
          }
          return result;
        }
        function compact(array) {
          var index = -1,
              length = array ? array.length : 0,
              resIndex = -1,
              result = [];
          while (++index < length) {
            var value = array[index];
            if (value) {
              result[++resIndex] = value;
            }
          }
          return result;
        }
        var difference = restParam(function(array, values) {
          return (isArray(array) || isArguments(array)) ? baseDifference(array, baseFlatten(values, false, true)) : [];
        });
        function drop(array, n, guard) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (guard ? isIterateeCall(array, n, guard) : n == null) {
            n = 1;
          }
          return baseSlice(array, n < 0 ? 0 : n);
        }
        function dropRight(array, n, guard) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (guard ? isIterateeCall(array, n, guard) : n == null) {
            n = 1;
          }
          n = length - (+n || 0);
          return baseSlice(array, 0, n < 0 ? 0 : n);
        }
        function dropRightWhile(array, predicate, thisArg) {
          return (array && array.length) ? baseWhile(array, getCallback(predicate, thisArg, 3), true, true) : [];
        }
        function dropWhile(array, predicate, thisArg) {
          return (array && array.length) ? baseWhile(array, getCallback(predicate, thisArg, 3), true) : [];
        }
        function fill(array, value, start, end) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (start && typeof start != 'number' && isIterateeCall(array, value, start)) {
            start = 0;
            end = length;
          }
          return baseFill(array, value, start, end);
        }
        var findIndex = createFindIndex();
        var findLastIndex = createFindIndex(true);
        function first(array) {
          return array ? array[0] : undefined;
        }
        function flatten(array, isDeep, guard) {
          var length = array ? array.length : 0;
          if (guard && isIterateeCall(array, isDeep, guard)) {
            isDeep = false;
          }
          return length ? baseFlatten(array, isDeep) : [];
        }
        function flattenDeep(array) {
          var length = array ? array.length : 0;
          return length ? baseFlatten(array, true) : [];
        }
        function indexOf(array, value, fromIndex) {
          var length = array ? array.length : 0;
          if (!length) {
            return -1;
          }
          if (typeof fromIndex == 'number') {
            fromIndex = fromIndex < 0 ? nativeMax(length + fromIndex, 0) : fromIndex;
          } else if (fromIndex) {
            var index = binaryIndex(array, value),
                other = array[index];
            if (value === value ? (value === other) : (other !== other)) {
              return index;
            }
            return -1;
          }
          return baseIndexOf(array, value, fromIndex || 0);
        }
        function initial(array) {
          return dropRight(array, 1);
        }
        function intersection() {
          var args = [],
              argsIndex = -1,
              argsLength = arguments.length,
              caches = [],
              indexOf = getIndexOf(),
              isCommon = indexOf == baseIndexOf,
              result = [];
          while (++argsIndex < argsLength) {
            var value = arguments[argsIndex];
            if (isArray(value) || isArguments(value)) {
              args.push(value);
              caches.push((isCommon && value.length >= 120) ? createCache(argsIndex && value) : null);
            }
          }
          argsLength = args.length;
          if (argsLength < 2) {
            return result;
          }
          var array = args[0],
              index = -1,
              length = array ? array.length : 0,
              seen = caches[0];
          outer: while (++index < length) {
            value = array[index];
            if ((seen ? cacheIndexOf(seen, value) : indexOf(result, value, 0)) < 0) {
              argsIndex = argsLength;
              while (--argsIndex) {
                var cache = caches[argsIndex];
                if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value, 0)) < 0) {
                  continue outer;
                }
              }
              if (seen) {
                seen.push(value);
              }
              result.push(value);
            }
          }
          return result;
        }
        function last(array) {
          var length = array ? array.length : 0;
          return length ? array[length - 1] : undefined;
        }
        function lastIndexOf(array, value, fromIndex) {
          var length = array ? array.length : 0;
          if (!length) {
            return -1;
          }
          var index = length;
          if (typeof fromIndex == 'number') {
            index = (fromIndex < 0 ? nativeMax(length + fromIndex, 0) : nativeMin(fromIndex || 0, length - 1)) + 1;
          } else if (fromIndex) {
            index = binaryIndex(array, value, true) - 1;
            var other = array[index];
            if (value === value ? (value === other) : (other !== other)) {
              return index;
            }
            return -1;
          }
          if (value !== value) {
            return indexOfNaN(array, index, true);
          }
          while (index--) {
            if (array[index] === value) {
              return index;
            }
          }
          return -1;
        }
        function pull() {
          var args = arguments,
              array = args[0];
          if (!(array && array.length)) {
            return array;
          }
          var index = 0,
              indexOf = getIndexOf(),
              length = args.length;
          while (++index < length) {
            var fromIndex = 0,
                value = args[index];
            while ((fromIndex = indexOf(array, value, fromIndex)) > -1) {
              splice.call(array, fromIndex, 1);
            }
          }
          return array;
        }
        var pullAt = restParam(function(array, indexes) {
          array || (array = []);
          indexes = baseFlatten(indexes);
          var result = baseAt(array, indexes);
          basePullAt(array, indexes.sort(baseCompareAscending));
          return result;
        });
        function remove(array, predicate, thisArg) {
          var result = [];
          if (!(array && array.length)) {
            return result;
          }
          var index = -1,
              indexes = [],
              length = array.length;
          predicate = getCallback(predicate, thisArg, 3);
          while (++index < length) {
            var value = array[index];
            if (predicate(value, index, array)) {
              result.push(value);
              indexes.push(index);
            }
          }
          basePullAt(array, indexes);
          return result;
        }
        function rest(array) {
          return drop(array, 1);
        }
        function slice(array, start, end) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (end && typeof end != 'number' && isIterateeCall(array, start, end)) {
            start = 0;
            end = length;
          }
          return baseSlice(array, start, end);
        }
        var sortedIndex = createSortedIndex();
        var sortedLastIndex = createSortedIndex(true);
        function take(array, n, guard) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (guard ? isIterateeCall(array, n, guard) : n == null) {
            n = 1;
          }
          return baseSlice(array, 0, n < 0 ? 0 : n);
        }
        function takeRight(array, n, guard) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (guard ? isIterateeCall(array, n, guard) : n == null) {
            n = 1;
          }
          n = length - (+n || 0);
          return baseSlice(array, n < 0 ? 0 : n);
        }
        function takeRightWhile(array, predicate, thisArg) {
          return (array && array.length) ? baseWhile(array, getCallback(predicate, thisArg, 3), false, true) : [];
        }
        function takeWhile(array, predicate, thisArg) {
          return (array && array.length) ? baseWhile(array, getCallback(predicate, thisArg, 3)) : [];
        }
        var union = restParam(function(arrays) {
          return baseUniq(baseFlatten(arrays, false, true));
        });
        function uniq(array, isSorted, iteratee, thisArg) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          if (isSorted != null && typeof isSorted != 'boolean') {
            thisArg = iteratee;
            iteratee = isIterateeCall(array, isSorted, thisArg) ? null : isSorted;
            isSorted = false;
          }
          var func = getCallback();
          if (!(func === baseCallback && iteratee == null)) {
            iteratee = func(iteratee, thisArg, 3);
          }
          return (isSorted && getIndexOf() == baseIndexOf) ? sortedUniq(array, iteratee) : baseUniq(array, iteratee);
        }
        function unzip(array) {
          var index = -1,
              length = (array && array.length && arrayMax(arrayMap(array, getLength))) >>> 0,
              result = Array(length);
          while (++index < length) {
            result[index] = arrayMap(array, baseProperty(index));
          }
          return result;
        }
        var without = restParam(function(array, values) {
          return (isArray(array) || isArguments(array)) ? baseDifference(array, values) : [];
        });
        function xor() {
          var index = -1,
              length = arguments.length;
          while (++index < length) {
            var array = arguments[index];
            if (isArray(array) || isArguments(array)) {
              var result = result ? baseDifference(result, array).concat(baseDifference(array, result)) : array;
            }
          }
          return result ? baseUniq(result) : [];
        }
        var zip = restParam(unzip);
        function zipObject(props, values) {
          var index = -1,
              length = props ? props.length : 0,
              result = {};
          if (length && !values && !isArray(props[0])) {
            values = [];
          }
          while (++index < length) {
            var key = props[index];
            if (values) {
              result[key] = values[index];
            } else if (key) {
              result[key[0]] = key[1];
            }
          }
          return result;
        }
        function chain(value) {
          var result = lodash(value);
          result.__chain__ = true;
          return result;
        }
        function tap(value, interceptor, thisArg) {
          interceptor.call(thisArg, value);
          return value;
        }
        function thru(value, interceptor, thisArg) {
          return interceptor.call(thisArg, value);
        }
        function wrapperChain() {
          return chain(this);
        }
        function wrapperCommit() {
          return new LodashWrapper(this.value(), this.__chain__);
        }
        function wrapperPlant(value) {
          var result,
              parent = this;
          while (parent instanceof baseLodash) {
            var clone = wrapperClone(parent);
            if (result) {
              previous.__wrapped__ = clone;
            } else {
              result = clone;
            }
            var previous = clone;
            parent = parent.__wrapped__;
          }
          previous.__wrapped__ = value;
          return result;
        }
        function wrapperReverse() {
          var value = this.__wrapped__;
          if (value instanceof LazyWrapper) {
            if (this.__actions__.length) {
              value = new LazyWrapper(this);
            }
            return new LodashWrapper(value.reverse(), this.__chain__);
          }
          return this.thru(function(value) {
            return value.reverse();
          });
        }
        function wrapperToString() {
          return (this.value() + '');
        }
        function wrapperValue() {
          return baseWrapperValue(this.__wrapped__, this.__actions__);
        }
        var at = restParam(function(collection, props) {
          var length = collection ? getLength(collection) : 0;
          if (isLength(length)) {
            collection = toIterable(collection);
          }
          return baseAt(collection, baseFlatten(props));
        });
        var countBy = createAggregator(function(result, value, key) {
          hasOwnProperty.call(result, key) ? ++result[key] : (result[key] = 1);
        });
        function every(collection, predicate, thisArg) {
          var func = isArray(collection) ? arrayEvery : baseEvery;
          if (thisArg && isIterateeCall(collection, predicate, thisArg)) {
            predicate = null;
          }
          if (typeof predicate != 'function' || thisArg !== undefined) {
            predicate = getCallback(predicate, thisArg, 3);
          }
          return func(collection, predicate);
        }
        function filter(collection, predicate, thisArg) {
          var func = isArray(collection) ? arrayFilter : baseFilter;
          predicate = getCallback(predicate, thisArg, 3);
          return func(collection, predicate);
        }
        var find = createFind(baseEach);
        var findLast = createFind(baseEachRight, true);
        function findWhere(collection, source) {
          return find(collection, baseMatches(source));
        }
        var forEach = createForEach(arrayEach, baseEach);
        var forEachRight = createForEach(arrayEachRight, baseEachRight);
        var groupBy = createAggregator(function(result, value, key) {
          if (hasOwnProperty.call(result, key)) {
            result[key].push(value);
          } else {
            result[key] = [value];
          }
        });
        function includes(collection, target, fromIndex, guard) {
          var length = collection ? getLength(collection) : 0;
          if (!isLength(length)) {
            collection = values(collection);
            length = collection.length;
          }
          if (!length) {
            return false;
          }
          if (typeof fromIndex != 'number' || (guard && isIterateeCall(target, fromIndex, guard))) {
            fromIndex = 0;
          } else {
            fromIndex = fromIndex < 0 ? nativeMax(length + fromIndex, 0) : (fromIndex || 0);
          }
          return (typeof collection == 'string' || !isArray(collection) && isString(collection)) ? (fromIndex < length && collection.indexOf(target, fromIndex) > -1) : (getIndexOf(collection, target, fromIndex) > -1);
        }
        var indexBy = createAggregator(function(result, value, key) {
          result[key] = value;
        });
        var invoke = restParam(function(collection, path, args) {
          var index = -1,
              isFunc = typeof path == 'function',
              isProp = isKey(path),
              length = getLength(collection),
              result = isLength(length) ? Array(length) : [];
          baseEach(collection, function(value) {
            var func = isFunc ? path : (isProp && value != null && value[path]);
            result[++index] = func ? func.apply(value, args) : invokePath(value, path, args);
          });
          return result;
        });
        function map(collection, iteratee, thisArg) {
          var func = isArray(collection) ? arrayMap : baseMap;
          iteratee = getCallback(iteratee, thisArg, 3);
          return func(collection, iteratee);
        }
        var partition = createAggregator(function(result, value, key) {
          result[key ? 0 : 1].push(value);
        }, function() {
          return [[], []];
        });
        function pluck(collection, path) {
          return map(collection, property(path));
        }
        var reduce = createReduce(arrayReduce, baseEach);
        var reduceRight = createReduce(arrayReduceRight, baseEachRight);
        function reject(collection, predicate, thisArg) {
          var func = isArray(collection) ? arrayFilter : baseFilter;
          predicate = getCallback(predicate, thisArg, 3);
          return func(collection, function(value, index, collection) {
            return !predicate(value, index, collection);
          });
        }
        function sample(collection, n, guard) {
          if (guard ? isIterateeCall(collection, n, guard) : n == null) {
            collection = toIterable(collection);
            var length = collection.length;
            return length > 0 ? collection[baseRandom(0, length - 1)] : undefined;
          }
          var result = shuffle(collection);
          result.length = nativeMin(n < 0 ? 0 : (+n || 0), result.length);
          return result;
        }
        function shuffle(collection) {
          collection = toIterable(collection);
          var index = -1,
              length = collection.length,
              result = Array(length);
          while (++index < length) {
            var rand = baseRandom(0, index);
            if (index != rand) {
              result[index] = result[rand];
            }
            result[rand] = collection[index];
          }
          return result;
        }
        function size(collection) {
          var length = collection ? getLength(collection) : 0;
          return isLength(length) ? length : keys(collection).length;
        }
        function some(collection, predicate, thisArg) {
          var func = isArray(collection) ? arraySome : baseSome;
          if (thisArg && isIterateeCall(collection, predicate, thisArg)) {
            predicate = null;
          }
          if (typeof predicate != 'function' || thisArg !== undefined) {
            predicate = getCallback(predicate, thisArg, 3);
          }
          return func(collection, predicate);
        }
        function sortBy(collection, iteratee, thisArg) {
          if (collection == null) {
            return [];
          }
          if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
            iteratee = null;
          }
          var index = -1;
          iteratee = getCallback(iteratee, thisArg, 3);
          var result = baseMap(collection, function(value, key, collection) {
            return {
              'criteria': iteratee(value, key, collection),
              'index': ++index,
              'value': value
            };
          });
          return baseSortBy(result, compareAscending);
        }
        var sortByAll = restParam(function(collection, iteratees) {
          if (collection == null) {
            return [];
          }
          var guard = iteratees[2];
          if (guard && isIterateeCall(iteratees[0], iteratees[1], guard)) {
            iteratees.length = 1;
          }
          return baseSortByOrder(collection, baseFlatten(iteratees), []);
        });
        function sortByOrder(collection, iteratees, orders, guard) {
          if (collection == null) {
            return [];
          }
          if (guard && isIterateeCall(iteratees, orders, guard)) {
            orders = null;
          }
          if (!isArray(iteratees)) {
            iteratees = iteratees == null ? [] : [iteratees];
          }
          if (!isArray(orders)) {
            orders = orders == null ? [] : [orders];
          }
          return baseSortByOrder(collection, iteratees, orders);
        }
        function where(collection, source) {
          return filter(collection, baseMatches(source));
        }
        var now = nativeNow || function() {
          return new Date().getTime();
        };
        function after(n, func) {
          if (typeof func != 'function') {
            if (typeof n == 'function') {
              var temp = n;
              n = func;
              func = temp;
            } else {
              throw new TypeError(FUNC_ERROR_TEXT);
            }
          }
          n = nativeIsFinite(n = +n) ? n : 0;
          return function() {
            if (--n < 1) {
              return func.apply(this, arguments);
            }
          };
        }
        function ary(func, n, guard) {
          if (guard && isIterateeCall(func, n, guard)) {
            n = null;
          }
          n = (func && n == null) ? func.length : nativeMax(+n || 0, 0);
          return createWrapper(func, ARY_FLAG, null, null, null, null, n);
        }
        function before(n, func) {
          var result;
          if (typeof func != 'function') {
            if (typeof n == 'function') {
              var temp = n;
              n = func;
              func = temp;
            } else {
              throw new TypeError(FUNC_ERROR_TEXT);
            }
          }
          return function() {
            if (--n > 0) {
              result = func.apply(this, arguments);
            }
            if (n <= 1) {
              func = null;
            }
            return result;
          };
        }
        var bind = restParam(function(func, thisArg, partials) {
          var bitmask = BIND_FLAG;
          if (partials.length) {
            var holders = replaceHolders(partials, bind.placeholder);
            bitmask |= PARTIAL_FLAG;
          }
          return createWrapper(func, bitmask, thisArg, partials, holders);
        });
        var bindAll = restParam(function(object, methodNames) {
          methodNames = methodNames.length ? baseFlatten(methodNames) : functions(object);
          var index = -1,
              length = methodNames.length;
          while (++index < length) {
            var key = methodNames[index];
            object[key] = createWrapper(object[key], BIND_FLAG, object);
          }
          return object;
        });
        var bindKey = restParam(function(object, key, partials) {
          var bitmask = BIND_FLAG | BIND_KEY_FLAG;
          if (partials.length) {
            var holders = replaceHolders(partials, bindKey.placeholder);
            bitmask |= PARTIAL_FLAG;
          }
          return createWrapper(key, bitmask, object, partials, holders);
        });
        var curry = createCurry(CURRY_FLAG);
        var curryRight = createCurry(CURRY_RIGHT_FLAG);
        function debounce(func, wait, options) {
          var args,
              maxTimeoutId,
              result,
              stamp,
              thisArg,
              timeoutId,
              trailingCall,
              lastCalled = 0,
              maxWait = false,
              trailing = true;
          if (typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          wait = wait < 0 ? 0 : (+wait || 0);
          if (options === true) {
            var leading = true;
            trailing = false;
          } else if (isObject(options)) {
            leading = options.leading;
            maxWait = 'maxWait' in options && nativeMax(+options.maxWait || 0, wait);
            trailing = 'trailing' in options ? options.trailing : trailing;
          }
          function cancel() {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (maxTimeoutId) {
              clearTimeout(maxTimeoutId);
            }
            maxTimeoutId = timeoutId = trailingCall = undefined;
          }
          function delayed() {
            var remaining = wait - (now() - stamp);
            if (remaining <= 0 || remaining > wait) {
              if (maxTimeoutId) {
                clearTimeout(maxTimeoutId);
              }
              var isCalled = trailingCall;
              maxTimeoutId = timeoutId = trailingCall = undefined;
              if (isCalled) {
                lastCalled = now();
                result = func.apply(thisArg, args);
                if (!timeoutId && !maxTimeoutId) {
                  args = thisArg = null;
                }
              }
            } else {
              timeoutId = setTimeout(delayed, remaining);
            }
          }
          function maxDelayed() {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            maxTimeoutId = timeoutId = trailingCall = undefined;
            if (trailing || (maxWait !== wait)) {
              lastCalled = now();
              result = func.apply(thisArg, args);
              if (!timeoutId && !maxTimeoutId) {
                args = thisArg = null;
              }
            }
          }
          function debounced() {
            args = arguments;
            stamp = now();
            thisArg = this;
            trailingCall = trailing && (timeoutId || !leading);
            if (maxWait === false) {
              var leadingCall = leading && !timeoutId;
            } else {
              if (!maxTimeoutId && !leading) {
                lastCalled = stamp;
              }
              var remaining = maxWait - (stamp - lastCalled),
                  isCalled = remaining <= 0 || remaining > maxWait;
              if (isCalled) {
                if (maxTimeoutId) {
                  maxTimeoutId = clearTimeout(maxTimeoutId);
                }
                lastCalled = stamp;
                result = func.apply(thisArg, args);
              } else if (!maxTimeoutId) {
                maxTimeoutId = setTimeout(maxDelayed, remaining);
              }
            }
            if (isCalled && timeoutId) {
              timeoutId = clearTimeout(timeoutId);
            } else if (!timeoutId && wait !== maxWait) {
              timeoutId = setTimeout(delayed, wait);
            }
            if (leadingCall) {
              isCalled = true;
              result = func.apply(thisArg, args);
            }
            if (isCalled && !timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
            return result;
          }
          debounced.cancel = cancel;
          return debounced;
        }
        var defer = restParam(function(func, args) {
          return baseDelay(func, 1, args);
        });
        var delay = restParam(function(func, wait, args) {
          return baseDelay(func, wait, args);
        });
        var flow = createFlow();
        var flowRight = createFlow(true);
        function memoize(func, resolver) {
          if (typeof func != 'function' || (resolver && typeof resolver != 'function')) {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          var memoized = function() {
            var args = arguments,
                cache = memoized.cache,
                key = resolver ? resolver.apply(this, args) : args[0];
            if (cache.has(key)) {
              return cache.get(key);
            }
            var result = func.apply(this, args);
            cache.set(key, result);
            return result;
          };
          memoized.cache = new memoize.Cache;
          return memoized;
        }
        function negate(predicate) {
          if (typeof predicate != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          return function() {
            return !predicate.apply(this, arguments);
          };
        }
        function once(func) {
          return before(2, func);
        }
        var partial = createPartial(PARTIAL_FLAG);
        var partialRight = createPartial(PARTIAL_RIGHT_FLAG);
        var rearg = restParam(function(func, indexes) {
          return createWrapper(func, REARG_FLAG, null, null, null, baseFlatten(indexes));
        });
        function restParam(func, start) {
          if (typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
          return function() {
            var args = arguments,
                index = -1,
                length = nativeMax(args.length - start, 0),
                rest = Array(length);
            while (++index < length) {
              rest[index] = args[start + index];
            }
            switch (start) {
              case 0:
                return func.call(this, rest);
              case 1:
                return func.call(this, args[0], rest);
              case 2:
                return func.call(this, args[0], args[1], rest);
            }
            var otherArgs = Array(start + 1);
            index = -1;
            while (++index < start) {
              otherArgs[index] = args[index];
            }
            otherArgs[start] = rest;
            return func.apply(this, otherArgs);
          };
        }
        function spread(func) {
          if (typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          return function(array) {
            return func.apply(this, array);
          };
        }
        function throttle(func, wait, options) {
          var leading = true,
              trailing = true;
          if (typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          if (options === false) {
            leading = false;
          } else if (isObject(options)) {
            leading = 'leading' in options ? !!options.leading : leading;
            trailing = 'trailing' in options ? !!options.trailing : trailing;
          }
          debounceOptions.leading = leading;
          debounceOptions.maxWait = +wait;
          debounceOptions.trailing = trailing;
          return debounce(func, wait, debounceOptions);
        }
        function wrap(value, wrapper) {
          wrapper = wrapper == null ? identity : wrapper;
          return createWrapper(wrapper, PARTIAL_FLAG, null, [value], []);
        }
        function clone(value, isDeep, customizer, thisArg) {
          if (isDeep && typeof isDeep != 'boolean' && isIterateeCall(value, isDeep, customizer)) {
            isDeep = false;
          } else if (typeof isDeep == 'function') {
            thisArg = customizer;
            customizer = isDeep;
            isDeep = false;
          }
          customizer = typeof customizer == 'function' && bindCallback(customizer, thisArg, 1);
          return baseClone(value, isDeep, customizer);
        }
        function cloneDeep(value, customizer, thisArg) {
          customizer = typeof customizer == 'function' && bindCallback(customizer, thisArg, 1);
          return baseClone(value, true, customizer);
        }
        function isArguments(value) {
          var length = isObjectLike(value) ? value.length : undefined;
          return isLength(length) && objToString.call(value) == argsTag;
        }
        var isArray = nativeIsArray || function(value) {
          return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
        };
        function isBoolean(value) {
          return value === true || value === false || (isObjectLike(value) && objToString.call(value) == boolTag);
        }
        function isDate(value) {
          return isObjectLike(value) && objToString.call(value) == dateTag;
        }
        function isElement(value) {
          return !!value && value.nodeType === 1 && isObjectLike(value) && (objToString.call(value).indexOf('Element') > -1);
        }
        if (!support.dom) {
          isElement = function(value) {
            return !!value && value.nodeType === 1 && isObjectLike(value) && !isPlainObject(value);
          };
        }
        function isEmpty(value) {
          if (value == null) {
            return true;
          }
          var length = getLength(value);
          if (isLength(length) && (isArray(value) || isString(value) || isArguments(value) || (isObjectLike(value) && isFunction(value.splice)))) {
            return !length;
          }
          return !keys(value).length;
        }
        function isEqual(value, other, customizer, thisArg) {
          customizer = typeof customizer == 'function' && bindCallback(customizer, thisArg, 3);
          if (!customizer && isStrictComparable(value) && isStrictComparable(other)) {
            return value === other;
          }
          var result = customizer ? customizer(value, other) : undefined;
          return result === undefined ? baseIsEqual(value, other, customizer) : !!result;
        }
        function isError(value) {
          return isObjectLike(value) && typeof value.message == 'string' && objToString.call(value) == errorTag;
        }
        var isFinite = nativeNumIsFinite || function(value) {
          return typeof value == 'number' && nativeIsFinite(value);
        };
        var isFunction = !(baseIsFunction(/x/) || (Uint8Array && !baseIsFunction(Uint8Array))) ? baseIsFunction : function(value) {
          return objToString.call(value) == funcTag;
        };
        function isObject(value) {
          var type = typeof value;
          return type == 'function' || (!!value && type == 'object');
        }
        function isMatch(object, source, customizer, thisArg) {
          var props = keys(source),
              length = props.length;
          if (!length) {
            return true;
          }
          if (object == null) {
            return false;
          }
          customizer = typeof customizer == 'function' && bindCallback(customizer, thisArg, 3);
          object = toObject(object);
          if (!customizer && length == 1) {
            var key = props[0],
                value = source[key];
            if (isStrictComparable(value)) {
              return value === object[key] && (value !== undefined || (key in object));
            }
          }
          var values = Array(length),
              strictCompareFlags = Array(length);
          while (length--) {
            value = values[length] = source[props[length]];
            strictCompareFlags[length] = isStrictComparable(value);
          }
          return baseIsMatch(object, props, values, strictCompareFlags, customizer);
        }
        function isNaN(value) {
          return isNumber(value) && value != +value;
        }
        function isNative(value) {
          if (value == null) {
            return false;
          }
          if (objToString.call(value) == funcTag) {
            return reIsNative.test(fnToString.call(value));
          }
          return isObjectLike(value) && reIsHostCtor.test(value);
        }
        function isNull(value) {
          return value === null;
        }
        function isNumber(value) {
          return typeof value == 'number' || (isObjectLike(value) && objToString.call(value) == numberTag);
        }
        var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
          if (!(value && objToString.call(value) == objectTag)) {
            return false;
          }
          var valueOf = value.valueOf,
              objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);
          return objProto ? (value == objProto || getPrototypeOf(value) == objProto) : shimIsPlainObject(value);
        };
        function isRegExp(value) {
          return (isObjectLike(value) && objToString.call(value) == regexpTag) || false;
        }
        function isString(value) {
          return typeof value == 'string' || (isObjectLike(value) && objToString.call(value) == stringTag);
        }
        function isTypedArray(value) {
          return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[objToString.call(value)];
        }
        function isUndefined(value) {
          return value === undefined;
        }
        function toArray(value) {
          var length = value ? getLength(value) : 0;
          if (!isLength(length)) {
            return values(value);
          }
          if (!length) {
            return [];
          }
          return arrayCopy(value);
        }
        function toPlainObject(value) {
          return baseCopy(value, keysIn(value));
        }
        var assign = createAssigner(function(object, source, customizer) {
          return customizer ? assignWith(object, source, customizer) : baseAssign(object, source);
        });
        function create(prototype, properties, guard) {
          var result = baseCreate(prototype);
          if (guard && isIterateeCall(prototype, properties, guard)) {
            properties = null;
          }
          return properties ? baseAssign(result, properties) : result;
        }
        var defaults = restParam(function(args) {
          var object = args[0];
          if (object == null) {
            return object;
          }
          args.push(assignDefaults);
          return assign.apply(undefined, args);
        });
        var findKey = createFindKey(baseForOwn);
        var findLastKey = createFindKey(baseForOwnRight);
        var forIn = createForIn(baseFor);
        var forInRight = createForIn(baseForRight);
        var forOwn = createForOwn(baseForOwn);
        var forOwnRight = createForOwn(baseForOwnRight);
        function functions(object) {
          return baseFunctions(object, keysIn(object));
        }
        function get(object, path, defaultValue) {
          var result = object == null ? undefined : baseGet(object, toPath(path), path + '');
          return result === undefined ? defaultValue : result;
        }
        function has(object, path) {
          if (object == null) {
            return false;
          }
          var result = hasOwnProperty.call(object, path);
          if (!result && !isKey(path)) {
            path = toPath(path);
            object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
            path = last(path);
            result = object != null && hasOwnProperty.call(object, path);
          }
          return result;
        }
        function invert(object, multiValue, guard) {
          if (guard && isIterateeCall(object, multiValue, guard)) {
            multiValue = null;
          }
          var index = -1,
              props = keys(object),
              length = props.length,
              result = {};
          while (++index < length) {
            var key = props[index],
                value = object[key];
            if (multiValue) {
              if (hasOwnProperty.call(result, value)) {
                result[value].push(key);
              } else {
                result[value] = [key];
              }
            } else {
              result[value] = key;
            }
          }
          return result;
        }
        var keys = !nativeKeys ? shimKeys : function(object) {
          if (object) {
            var Ctor = object.constructor,
                length = object.length;
          }
          if ((typeof Ctor == 'function' && Ctor.prototype === object) || (typeof object != 'function' && isLength(length))) {
            return shimKeys(object);
          }
          return isObject(object) ? nativeKeys(object) : [];
        };
        function keysIn(object) {
          if (object == null) {
            return [];
          }
          if (!isObject(object)) {
            object = Object(object);
          }
          var length = object.length;
          length = (length && isLength(length) && (isArray(object) || (support.nonEnumArgs && isArguments(object))) && length) || 0;
          var Ctor = object.constructor,
              index = -1,
              isProto = typeof Ctor == 'function' && Ctor.prototype === object,
              result = Array(length),
              skipIndexes = length > 0;
          while (++index < length) {
            result[index] = (index + '');
          }
          for (var key in object) {
            if (!(skipIndexes && isIndex(key, length)) && !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
              result.push(key);
            }
          }
          return result;
        }
        function mapValues(object, iteratee, thisArg) {
          var result = {};
          iteratee = getCallback(iteratee, thisArg, 3);
          baseForOwn(object, function(value, key, object) {
            result[key] = iteratee(value, key, object);
          });
          return result;
        }
        var merge = createAssigner(baseMerge);
        var omit = restParam(function(object, props) {
          if (object == null) {
            return {};
          }
          if (typeof props[0] != 'function') {
            var props = arrayMap(baseFlatten(props), String);
            return pickByArray(object, baseDifference(keysIn(object), props));
          }
          var predicate = bindCallback(props[0], props[1], 3);
          return pickByCallback(object, function(value, key, object) {
            return !predicate(value, key, object);
          });
        });
        function pairs(object) {
          var index = -1,
              props = keys(object),
              length = props.length,
              result = Array(length);
          while (++index < length) {
            var key = props[index];
            result[index] = [key, object[key]];
          }
          return result;
        }
        var pick = restParam(function(object, props) {
          if (object == null) {
            return {};
          }
          return typeof props[0] == 'function' ? pickByCallback(object, bindCallback(props[0], props[1], 3)) : pickByArray(object, baseFlatten(props));
        });
        function result(object, path, defaultValue) {
          var result = object == null ? undefined : object[path];
          if (result === undefined) {
            if (object != null && !isKey(path, object)) {
              path = toPath(path);
              object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
              result = object == null ? undefined : object[last(path)];
            }
            result = result === undefined ? defaultValue : result;
          }
          return isFunction(result) ? result.call(object) : result;
        }
        function set(object, path, value) {
          if (object == null) {
            return object;
          }
          var pathKey = (path + '');
          path = (object[pathKey] != null || isKey(path, object)) ? [pathKey] : toPath(path);
          var index = -1,
              length = path.length,
              endIndex = length - 1,
              nested = object;
          while (nested != null && ++index < length) {
            var key = path[index];
            if (isObject(nested)) {
              if (index == endIndex) {
                nested[key] = value;
              } else if (nested[key] == null) {
                nested[key] = isIndex(path[index + 1]) ? [] : {};
              }
            }
            nested = nested[key];
          }
          return object;
        }
        function transform(object, iteratee, accumulator, thisArg) {
          var isArr = isArray(object) || isTypedArray(object);
          iteratee = getCallback(iteratee, thisArg, 4);
          if (accumulator == null) {
            if (isArr || isObject(object)) {
              var Ctor = object.constructor;
              if (isArr) {
                accumulator = isArray(object) ? new Ctor : [];
              } else {
                accumulator = baseCreate(isFunction(Ctor) && Ctor.prototype);
              }
            } else {
              accumulator = {};
            }
          }
          (isArr ? arrayEach : baseForOwn)(object, function(value, index, object) {
            return iteratee(accumulator, value, index, object);
          });
          return accumulator;
        }
        function values(object) {
          return baseValues(object, keys(object));
        }
        function valuesIn(object) {
          return baseValues(object, keysIn(object));
        }
        function inRange(value, start, end) {
          start = +start || 0;
          if (typeof end === 'undefined') {
            end = start;
            start = 0;
          } else {
            end = +end || 0;
          }
          return value >= nativeMin(start, end) && value < nativeMax(start, end);
        }
        function random(min, max, floating) {
          if (floating && isIterateeCall(min, max, floating)) {
            max = floating = null;
          }
          var noMin = min == null,
              noMax = max == null;
          if (floating == null) {
            if (noMax && typeof min == 'boolean') {
              floating = min;
              min = 1;
            } else if (typeof max == 'boolean') {
              floating = max;
              noMax = true;
            }
          }
          if (noMin && noMax) {
            max = 1;
            noMax = false;
          }
          min = +min || 0;
          if (noMax) {
            max = min;
            min = 0;
          } else {
            max = +max || 0;
          }
          if (floating || min % 1 || max % 1) {
            var rand = nativeRandom();
            return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand + '').length - 1)))), max);
          }
          return baseRandom(min, max);
        }
        var camelCase = createCompounder(function(result, word, index) {
          word = word.toLowerCase();
          return result + (index ? (word.charAt(0).toUpperCase() + word.slice(1)) : word);
        });
        function capitalize(string) {
          string = baseToString(string);
          return string && (string.charAt(0).toUpperCase() + string.slice(1));
        }
        function deburr(string) {
          string = baseToString(string);
          return string && string.replace(reLatin1, deburrLetter).replace(reComboMark, '');
        }
        function endsWith(string, target, position) {
          string = baseToString(string);
          target = (target + '');
          var length = string.length;
          position = position === undefined ? length : nativeMin(position < 0 ? 0 : (+position || 0), length);
          position -= target.length;
          return position >= 0 && string.indexOf(target, position) == position;
        }
        function escape(string) {
          string = baseToString(string);
          return (string && reHasUnescapedHtml.test(string)) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
        }
        function escapeRegExp(string) {
          string = baseToString(string);
          return (string && reHasRegExpChars.test(string)) ? string.replace(reRegExpChars, '\\$&') : string;
        }
        var kebabCase = createCompounder(function(result, word, index) {
          return result + (index ? '-' : '') + word.toLowerCase();
        });
        function pad(string, length, chars) {
          string = baseToString(string);
          length = +length;
          var strLength = string.length;
          if (strLength >= length || !nativeIsFinite(length)) {
            return string;
          }
          var mid = (length - strLength) / 2,
              leftLength = floor(mid),
              rightLength = ceil(mid);
          chars = createPadding('', rightLength, chars);
          return chars.slice(0, leftLength) + string + chars;
        }
        var padLeft = createPadDir();
        var padRight = createPadDir(true);
        function parseInt(string, radix, guard) {
          if (guard && isIterateeCall(string, radix, guard)) {
            radix = 0;
          }
          return nativeParseInt(string, radix);
        }
        if (nativeParseInt(whitespace + '08') != 8) {
          parseInt = function(string, radix, guard) {
            if (guard ? isIterateeCall(string, radix, guard) : radix == null) {
              radix = 0;
            } else if (radix) {
              radix = +radix;
            }
            string = trim(string);
            return nativeParseInt(string, radix || (reHasHexPrefix.test(string) ? 16 : 10));
          };
        }
        function repeat(string, n) {
          var result = '';
          string = baseToString(string);
          n = +n;
          if (n < 1 || !string || !nativeIsFinite(n)) {
            return result;
          }
          do {
            if (n % 2) {
              result += string;
            }
            n = floor(n / 2);
            string += string;
          } while (n);
          return result;
        }
        var snakeCase = createCompounder(function(result, word, index) {
          return result + (index ? '_' : '') + word.toLowerCase();
        });
        var startCase = createCompounder(function(result, word, index) {
          return result + (index ? ' ' : '') + (word.charAt(0).toUpperCase() + word.slice(1));
        });
        function startsWith(string, target, position) {
          string = baseToString(string);
          position = position == null ? 0 : nativeMin(position < 0 ? 0 : (+position || 0), string.length);
          return string.lastIndexOf(target, position) == position;
        }
        function template(string, options, otherOptions) {
          var settings = lodash.templateSettings;
          if (otherOptions && isIterateeCall(string, options, otherOptions)) {
            options = otherOptions = null;
          }
          string = baseToString(string);
          options = assignWith(baseAssign({}, otherOptions || options), settings, assignOwnDefaults);
          var imports = assignWith(baseAssign({}, options.imports), settings.imports, assignOwnDefaults),
              importsKeys = keys(imports),
              importsValues = baseValues(imports, importsKeys);
          var isEscaping,
              isEvaluating,
              index = 0,
              interpolate = options.interpolate || reNoMatch,
              source = "__p += '";
          var reDelimiters = RegExp((options.escape || reNoMatch).source + '|' + interpolate.source + '|' + (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' + (options.evaluate || reNoMatch).source + '|$', 'g');
          var sourceURL = '//# sourceURL=' + ('sourceURL' in options ? options.sourceURL : ('lodash.templateSources[' + (++templateCounter) + ']')) + '\n';
          string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
            interpolateValue || (interpolateValue = esTemplateValue);
            source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
            if (escapeValue) {
              isEscaping = true;
              source += "' +\n__e(" + escapeValue + ") +\n'";
            }
            if (evaluateValue) {
              isEvaluating = true;
              source += "';\n" + evaluateValue + ";\n__p += '";
            }
            if (interpolateValue) {
              source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
            }
            index = offset + match.length;
            return match;
          });
          source += "';\n";
          var variable = options.variable;
          if (!variable) {
            source = 'with (obj) {\n' + source + '\n}\n';
          }
          source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source).replace(reEmptyStringMiddle, '$1').replace(reEmptyStringTrailing, '$1;');
          source = 'function(' + (variable || 'obj') + ') {\n' + (variable ? '' : 'obj || (obj = {});\n') + "var __t, __p = ''" + (isEscaping ? ', __e = _.escape' : '') + (isEvaluating ? ', __j = Array.prototype.join;\n' + "function print() { __p += __j.call(arguments, '') }\n" : ';\n') + source + 'return __p\n}';
          var result = attempt(function() {
            return Function(importsKeys, sourceURL + 'return ' + source).apply(undefined, importsValues);
          });
          result.source = source;
          if (isError(result)) {
            throw result;
          }
          return result;
        }
        function trim(string, chars, guard) {
          var value = string;
          string = baseToString(string);
          if (!string) {
            return string;
          }
          if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
            return string.slice(trimmedLeftIndex(string), trimmedRightIndex(string) + 1);
          }
          chars = (chars + '');
          return string.slice(charsLeftIndex(string, chars), charsRightIndex(string, chars) + 1);
        }
        function trimLeft(string, chars, guard) {
          var value = string;
          string = baseToString(string);
          if (!string) {
            return string;
          }
          if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
            return string.slice(trimmedLeftIndex(string));
          }
          return string.slice(charsLeftIndex(string, (chars + '')));
        }
        function trimRight(string, chars, guard) {
          var value = string;
          string = baseToString(string);
          if (!string) {
            return string;
          }
          if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
            return string.slice(0, trimmedRightIndex(string) + 1);
          }
          return string.slice(0, charsRightIndex(string, (chars + '')) + 1);
        }
        function trunc(string, options, guard) {
          if (guard && isIterateeCall(string, options, guard)) {
            options = null;
          }
          var length = DEFAULT_TRUNC_LENGTH,
              omission = DEFAULT_TRUNC_OMISSION;
          if (options != null) {
            if (isObject(options)) {
              var separator = 'separator' in options ? options.separator : separator;
              length = 'length' in options ? (+options.length || 0) : length;
              omission = 'omission' in options ? baseToString(options.omission) : omission;
            } else {
              length = +options || 0;
            }
          }
          string = baseToString(string);
          if (length >= string.length) {
            return string;
          }
          var end = length - omission.length;
          if (end < 1) {
            return omission;
          }
          var result = string.slice(0, end);
          if (separator == null) {
            return result + omission;
          }
          if (isRegExp(separator)) {
            if (string.slice(end).search(separator)) {
              var match,
                  newEnd,
                  substring = string.slice(0, end);
              if (!separator.global) {
                separator = RegExp(separator.source, (reFlags.exec(separator) || '') + 'g');
              }
              separator.lastIndex = 0;
              while ((match = separator.exec(substring))) {
                newEnd = match.index;
              }
              result = result.slice(0, newEnd == null ? end : newEnd);
            }
          } else if (string.indexOf(separator, end) != end) {
            var index = result.lastIndexOf(separator);
            if (index > -1) {
              result = result.slice(0, index);
            }
          }
          return result + omission;
        }
        function unescape(string) {
          string = baseToString(string);
          return (string && reHasEscapedHtml.test(string)) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
        }
        function words(string, pattern, guard) {
          if (guard && isIterateeCall(string, pattern, guard)) {
            pattern = null;
          }
          string = baseToString(string);
          return string.match(pattern || reWords) || [];
        }
        var attempt = restParam(function(func, args) {
          try {
            return func.apply(undefined, args);
          } catch (e) {
            return isError(e) ? e : new Error(e);
          }
        });
        function callback(func, thisArg, guard) {
          if (guard && isIterateeCall(func, thisArg, guard)) {
            thisArg = null;
          }
          return baseCallback(func, thisArg);
        }
        function constant(value) {
          return function() {
            return value;
          };
        }
        function identity(value) {
          return value;
        }
        function matches(source) {
          return baseMatches(baseClone(source, true));
        }
        function matchesProperty(path, value) {
          return baseMatchesProperty(path, baseClone(value, true));
        }
        var method = restParam(function(path, args) {
          return function(object) {
            return invokePath(object, path, args);
          };
        });
        var methodOf = restParam(function(object, args) {
          return function(path) {
            return invokePath(object, path, args);
          };
        });
        function mixin(object, source, options) {
          if (options == null) {
            var isObj = isObject(source),
                props = isObj && keys(source),
                methodNames = props && props.length && baseFunctions(source, props);
            if (!(methodNames ? methodNames.length : isObj)) {
              methodNames = false;
              options = source;
              source = object;
              object = this;
            }
          }
          if (!methodNames) {
            methodNames = baseFunctions(source, keys(source));
          }
          var chain = true,
              index = -1,
              isFunc = isFunction(object),
              length = methodNames.length;
          if (options === false) {
            chain = false;
          } else if (isObject(options) && 'chain' in options) {
            chain = options.chain;
          }
          while (++index < length) {
            var methodName = methodNames[index],
                func = source[methodName];
            object[methodName] = func;
            if (isFunc) {
              object.prototype[methodName] = (function(func) {
                return function() {
                  var chainAll = this.__chain__;
                  if (chain || chainAll) {
                    var result = object(this.__wrapped__),
                        actions = result.__actions__ = arrayCopy(this.__actions__);
                    actions.push({
                      'func': func,
                      'args': arguments,
                      'thisArg': object
                    });
                    result.__chain__ = chainAll;
                    return result;
                  }
                  var args = [this.value()];
                  push.apply(args, arguments);
                  return func.apply(object, args);
                };
              }(func));
            }
          }
          return object;
        }
        function noConflict() {
          context._ = oldDash;
          return this;
        }
        function noop() {}
        function property(path) {
          return isKey(path) ? baseProperty(path) : basePropertyDeep(path);
        }
        function propertyOf(object) {
          return function(path) {
            return baseGet(object, toPath(path), path + '');
          };
        }
        function range(start, end, step) {
          if (step && isIterateeCall(start, end, step)) {
            end = step = null;
          }
          start = +start || 0;
          step = step == null ? 1 : (+step || 0);
          if (end == null) {
            end = start;
            start = 0;
          } else {
            end = +end || 0;
          }
          var index = -1,
              length = nativeMax(ceil((end - start) / (step || 1)), 0),
              result = Array(length);
          while (++index < length) {
            result[index] = start;
            start += step;
          }
          return result;
        }
        function times(n, iteratee, thisArg) {
          n = floor(n);
          if (n < 1 || !nativeIsFinite(n)) {
            return [];
          }
          var index = -1,
              result = Array(nativeMin(n, MAX_ARRAY_LENGTH));
          iteratee = bindCallback(iteratee, thisArg, 1);
          while (++index < n) {
            if (index < MAX_ARRAY_LENGTH) {
              result[index] = iteratee(index);
            } else {
              iteratee(index);
            }
          }
          return result;
        }
        function uniqueId(prefix) {
          var id = ++idCounter;
          return baseToString(prefix) + id;
        }
        function add(augend, addend) {
          return (+augend || 0) + (+addend || 0);
        }
        var max = createExtremum(arrayMax);
        var min = createExtremum(arrayMin, true);
        function sum(collection, iteratee, thisArg) {
          if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
            iteratee = null;
          }
          var func = getCallback(),
              noIteratee = iteratee == null;
          if (!(func === baseCallback && noIteratee)) {
            noIteratee = false;
            iteratee = func(iteratee, thisArg, 3);
          }
          return noIteratee ? arraySum(isArray(collection) ? collection : toIterable(collection)) : baseSum(collection, iteratee);
        }
        lodash.prototype = baseLodash.prototype;
        LodashWrapper.prototype = baseCreate(baseLodash.prototype);
        LodashWrapper.prototype.constructor = LodashWrapper;
        LazyWrapper.prototype = baseCreate(baseLodash.prototype);
        LazyWrapper.prototype.constructor = LazyWrapper;
        MapCache.prototype['delete'] = mapDelete;
        MapCache.prototype.get = mapGet;
        MapCache.prototype.has = mapHas;
        MapCache.prototype.set = mapSet;
        SetCache.prototype.push = cachePush;
        memoize.Cache = MapCache;
        lodash.after = after;
        lodash.ary = ary;
        lodash.assign = assign;
        lodash.at = at;
        lodash.before = before;
        lodash.bind = bind;
        lodash.bindAll = bindAll;
        lodash.bindKey = bindKey;
        lodash.callback = callback;
        lodash.chain = chain;
        lodash.chunk = chunk;
        lodash.compact = compact;
        lodash.constant = constant;
        lodash.countBy = countBy;
        lodash.create = create;
        lodash.curry = curry;
        lodash.curryRight = curryRight;
        lodash.debounce = debounce;
        lodash.defaults = defaults;
        lodash.defer = defer;
        lodash.delay = delay;
        lodash.difference = difference;
        lodash.drop = drop;
        lodash.dropRight = dropRight;
        lodash.dropRightWhile = dropRightWhile;
        lodash.dropWhile = dropWhile;
        lodash.fill = fill;
        lodash.filter = filter;
        lodash.flatten = flatten;
        lodash.flattenDeep = flattenDeep;
        lodash.flow = flow;
        lodash.flowRight = flowRight;
        lodash.forEach = forEach;
        lodash.forEachRight = forEachRight;
        lodash.forIn = forIn;
        lodash.forInRight = forInRight;
        lodash.forOwn = forOwn;
        lodash.forOwnRight = forOwnRight;
        lodash.functions = functions;
        lodash.groupBy = groupBy;
        lodash.indexBy = indexBy;
        lodash.initial = initial;
        lodash.intersection = intersection;
        lodash.invert = invert;
        lodash.invoke = invoke;
        lodash.keys = keys;
        lodash.keysIn = keysIn;
        lodash.map = map;
        lodash.mapValues = mapValues;
        lodash.matches = matches;
        lodash.matchesProperty = matchesProperty;
        lodash.memoize = memoize;
        lodash.merge = merge;
        lodash.method = method;
        lodash.methodOf = methodOf;
        lodash.mixin = mixin;
        lodash.negate = negate;
        lodash.omit = omit;
        lodash.once = once;
        lodash.pairs = pairs;
        lodash.partial = partial;
        lodash.partialRight = partialRight;
        lodash.partition = partition;
        lodash.pick = pick;
        lodash.pluck = pluck;
        lodash.property = property;
        lodash.propertyOf = propertyOf;
        lodash.pull = pull;
        lodash.pullAt = pullAt;
        lodash.range = range;
        lodash.rearg = rearg;
        lodash.reject = reject;
        lodash.remove = remove;
        lodash.rest = rest;
        lodash.restParam = restParam;
        lodash.set = set;
        lodash.shuffle = shuffle;
        lodash.slice = slice;
        lodash.sortBy = sortBy;
        lodash.sortByAll = sortByAll;
        lodash.sortByOrder = sortByOrder;
        lodash.spread = spread;
        lodash.take = take;
        lodash.takeRight = takeRight;
        lodash.takeRightWhile = takeRightWhile;
        lodash.takeWhile = takeWhile;
        lodash.tap = tap;
        lodash.throttle = throttle;
        lodash.thru = thru;
        lodash.times = times;
        lodash.toArray = toArray;
        lodash.toPlainObject = toPlainObject;
        lodash.transform = transform;
        lodash.union = union;
        lodash.uniq = uniq;
        lodash.unzip = unzip;
        lodash.values = values;
        lodash.valuesIn = valuesIn;
        lodash.where = where;
        lodash.without = without;
        lodash.wrap = wrap;
        lodash.xor = xor;
        lodash.zip = zip;
        lodash.zipObject = zipObject;
        lodash.backflow = flowRight;
        lodash.collect = map;
        lodash.compose = flowRight;
        lodash.each = forEach;
        lodash.eachRight = forEachRight;
        lodash.extend = assign;
        lodash.iteratee = callback;
        lodash.methods = functions;
        lodash.object = zipObject;
        lodash.select = filter;
        lodash.tail = rest;
        lodash.unique = uniq;
        mixin(lodash, lodash);
        lodash.add = add;
        lodash.attempt = attempt;
        lodash.camelCase = camelCase;
        lodash.capitalize = capitalize;
        lodash.clone = clone;
        lodash.cloneDeep = cloneDeep;
        lodash.deburr = deburr;
        lodash.endsWith = endsWith;
        lodash.escape = escape;
        lodash.escapeRegExp = escapeRegExp;
        lodash.every = every;
        lodash.find = find;
        lodash.findIndex = findIndex;
        lodash.findKey = findKey;
        lodash.findLast = findLast;
        lodash.findLastIndex = findLastIndex;
        lodash.findLastKey = findLastKey;
        lodash.findWhere = findWhere;
        lodash.first = first;
        lodash.get = get;
        lodash.has = has;
        lodash.identity = identity;
        lodash.includes = includes;
        lodash.indexOf = indexOf;
        lodash.inRange = inRange;
        lodash.isArguments = isArguments;
        lodash.isArray = isArray;
        lodash.isBoolean = isBoolean;
        lodash.isDate = isDate;
        lodash.isElement = isElement;
        lodash.isEmpty = isEmpty;
        lodash.isEqual = isEqual;
        lodash.isError = isError;
        lodash.isFinite = isFinite;
        lodash.isFunction = isFunction;
        lodash.isMatch = isMatch;
        lodash.isNaN = isNaN;
        lodash.isNative = isNative;
        lodash.isNull = isNull;
        lodash.isNumber = isNumber;
        lodash.isObject = isObject;
        lodash.isPlainObject = isPlainObject;
        lodash.isRegExp = isRegExp;
        lodash.isString = isString;
        lodash.isTypedArray = isTypedArray;
        lodash.isUndefined = isUndefined;
        lodash.kebabCase = kebabCase;
        lodash.last = last;
        lodash.lastIndexOf = lastIndexOf;
        lodash.max = max;
        lodash.min = min;
        lodash.noConflict = noConflict;
        lodash.noop = noop;
        lodash.now = now;
        lodash.pad = pad;
        lodash.padLeft = padLeft;
        lodash.padRight = padRight;
        lodash.parseInt = parseInt;
        lodash.random = random;
        lodash.reduce = reduce;
        lodash.reduceRight = reduceRight;
        lodash.repeat = repeat;
        lodash.result = result;
        lodash.runInContext = runInContext;
        lodash.size = size;
        lodash.snakeCase = snakeCase;
        lodash.some = some;
        lodash.sortedIndex = sortedIndex;
        lodash.sortedLastIndex = sortedLastIndex;
        lodash.startCase = startCase;
        lodash.startsWith = startsWith;
        lodash.sum = sum;
        lodash.template = template;
        lodash.trim = trim;
        lodash.trimLeft = trimLeft;
        lodash.trimRight = trimRight;
        lodash.trunc = trunc;
        lodash.unescape = unescape;
        lodash.uniqueId = uniqueId;
        lodash.words = words;
        lodash.all = every;
        lodash.any = some;
        lodash.contains = includes;
        lodash.detect = find;
        lodash.foldl = reduce;
        lodash.foldr = reduceRight;
        lodash.head = first;
        lodash.include = includes;
        lodash.inject = reduce;
        mixin(lodash, (function() {
          var source = {};
          baseForOwn(lodash, function(func, methodName) {
            if (!lodash.prototype[methodName]) {
              source[methodName] = func;
            }
          });
          return source;
        }()), false);
        lodash.sample = sample;
        lodash.prototype.sample = function(n) {
          if (!this.__chain__ && n == null) {
            return sample(this.value());
          }
          return this.thru(function(value) {
            return sample(value, n);
          });
        };
        lodash.VERSION = VERSION;
        arrayEach(['bind', 'bindKey', 'curry', 'curryRight', 'partial', 'partialRight'], function(methodName) {
          lodash[methodName].placeholder = lodash;
        });
        arrayEach(['dropWhile', 'filter', 'map', 'takeWhile'], function(methodName, type) {
          var isFilter = type != LAZY_MAP_FLAG,
              isDropWhile = type == LAZY_DROP_WHILE_FLAG;
          LazyWrapper.prototype[methodName] = function(iteratee, thisArg) {
            var filtered = this.__filtered__,
                result = (filtered && isDropWhile) ? new LazyWrapper(this) : this.clone(),
                iteratees = result.__iteratees__ || (result.__iteratees__ = []);
            iteratees.push({
              'done': false,
              'count': 0,
              'index': 0,
              'iteratee': getCallback(iteratee, thisArg, 1),
              'limit': -1,
              'type': type
            });
            result.__filtered__ = filtered || isFilter;
            return result;
          };
        });
        arrayEach(['drop', 'take'], function(methodName, index) {
          var whileName = methodName + 'While';
          LazyWrapper.prototype[methodName] = function(n) {
            var filtered = this.__filtered__,
                result = (filtered && !index) ? this.dropWhile() : this.clone();
            n = n == null ? 1 : nativeMax(floor(n) || 0, 0);
            if (filtered) {
              if (index) {
                result.__takeCount__ = nativeMin(result.__takeCount__, n);
              } else {
                last(result.__iteratees__).limit = n;
              }
            } else {
              var views = result.__views__ || (result.__views__ = []);
              views.push({
                'size': n,
                'type': methodName + (result.__dir__ < 0 ? 'Right' : '')
              });
            }
            return result;
          };
          LazyWrapper.prototype[methodName + 'Right'] = function(n) {
            return this.reverse()[methodName](n).reverse();
          };
          LazyWrapper.prototype[methodName + 'RightWhile'] = function(predicate, thisArg) {
            return this.reverse()[whileName](predicate, thisArg).reverse();
          };
        });
        arrayEach(['first', 'last'], function(methodName, index) {
          var takeName = 'take' + (index ? 'Right' : '');
          LazyWrapper.prototype[methodName] = function() {
            return this[takeName](1).value()[0];
          };
        });
        arrayEach(['initial', 'rest'], function(methodName, index) {
          var dropName = 'drop' + (index ? '' : 'Right');
          LazyWrapper.prototype[methodName] = function() {
            return this[dropName](1);
          };
        });
        arrayEach(['pluck', 'where'], function(methodName, index) {
          var operationName = index ? 'filter' : 'map',
              createCallback = index ? baseMatches : property;
          LazyWrapper.prototype[methodName] = function(value) {
            return this[operationName](createCallback(value));
          };
        });
        LazyWrapper.prototype.compact = function() {
          return this.filter(identity);
        };
        LazyWrapper.prototype.reject = function(predicate, thisArg) {
          predicate = getCallback(predicate, thisArg, 1);
          return this.filter(function(value) {
            return !predicate(value);
          });
        };
        LazyWrapper.prototype.slice = function(start, end) {
          start = start == null ? 0 : (+start || 0);
          var result = start < 0 ? this.takeRight(-start) : this.drop(start);
          if (end !== undefined) {
            end = (+end || 0);
            result = end < 0 ? result.dropRight(-end) : result.take(end - start);
          }
          return result;
        };
        LazyWrapper.prototype.toArray = function() {
          return this.drop(0);
        };
        baseForOwn(LazyWrapper.prototype, function(func, methodName) {
          var lodashFunc = lodash[methodName];
          if (!lodashFunc) {
            return ;
          }
          var checkIteratee = /^(?:filter|map|reject)|While$/.test(methodName),
              retUnwrapped = /^(?:first|last)$/.test(methodName);
          lodash.prototype[methodName] = function() {
            var args = arguments,
                length = args.length,
                chainAll = this.__chain__,
                value = this.__wrapped__,
                isHybrid = !!this.__actions__.length,
                isLazy = value instanceof LazyWrapper,
                iteratee = args[0],
                useLazy = isLazy || isArray(value);
            if (useLazy && checkIteratee && typeof iteratee == 'function' && iteratee.length != 1) {
              isLazy = useLazy = false;
            }
            var onlyLazy = isLazy && !isHybrid;
            if (retUnwrapped && !chainAll) {
              return onlyLazy ? func.call(value) : lodashFunc.call(lodash, this.value());
            }
            var interceptor = function(value) {
              var otherArgs = [value];
              push.apply(otherArgs, args);
              return lodashFunc.apply(lodash, otherArgs);
            };
            if (useLazy) {
              var wrapper = onlyLazy ? value : new LazyWrapper(this),
                  result = func.apply(wrapper, args);
              if (!retUnwrapped && (isHybrid || result.__actions__)) {
                var actions = result.__actions__ || (result.__actions__ = []);
                actions.push({
                  'func': thru,
                  'args': [interceptor],
                  'thisArg': lodash
                });
              }
              return new LodashWrapper(result, chainAll);
            }
            return this.thru(interceptor);
          };
        });
        arrayEach(['concat', 'join', 'pop', 'push', 'replace', 'shift', 'sort', 'splice', 'split', 'unshift'], function(methodName) {
          var func = (/^(?:replace|split)$/.test(methodName) ? stringProto : arrayProto)[methodName],
              chainName = /^(?:push|sort|unshift)$/.test(methodName) ? 'tap' : 'thru',
              retUnwrapped = /^(?:join|pop|replace|shift)$/.test(methodName);
          lodash.prototype[methodName] = function() {
            var args = arguments;
            if (retUnwrapped && !this.__chain__) {
              return func.apply(this.value(), args);
            }
            return this[chainName](function(value) {
              return func.apply(value, args);
            });
          };
        });
        baseForOwn(LazyWrapper.prototype, function(func, methodName) {
          var lodashFunc = lodash[methodName];
          if (lodashFunc) {
            var key = lodashFunc.name,
                names = realNames[key] || (realNames[key] = []);
            names.push({
              'name': methodName,
              'func': lodashFunc
            });
          }
        });
        realNames[createHybridWrapper(null, BIND_KEY_FLAG).name] = [{
          'name': 'wrapper',
          'func': null
        }];
        LazyWrapper.prototype.clone = lazyClone;
        LazyWrapper.prototype.reverse = lazyReverse;
        LazyWrapper.prototype.value = lazyValue;
        lodash.prototype.chain = wrapperChain;
        lodash.prototype.commit = wrapperCommit;
        lodash.prototype.plant = wrapperPlant;
        lodash.prototype.reverse = wrapperReverse;
        lodash.prototype.toString = wrapperToString;
        lodash.prototype.run = lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;
        lodash.prototype.collect = lodash.prototype.map;
        lodash.prototype.head = lodash.prototype.first;
        lodash.prototype.select = lodash.prototype.filter;
        lodash.prototype.tail = lodash.prototype.rest;
        return lodash;
      }
      var _ = runInContext();
      if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
        root._ = _;
        define(function() {
          return _;
        });
      } else if (freeExports && freeModule) {
        if (moduleExports) {
          (freeModule.exports = _)._ = _;
        } else {
          freeExports._ = _;
        }
      } else {
        root._ = _;
      }
    }.call(this));
  })(require("github:jspm/nodelibs-process@0.1.1"));
  global.define = __define;
  return module.exports;
});



System.register("npm:famous@0.3.5/core/Engine", ["npm:famous@0.3.5/core/Context", "npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/OptionsManager"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Context = require("npm:famous@0.3.5/core/Context");
  var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
  var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
  var Engine = {};
  var contexts = [];
  var nextTickQueue = [];
  var currentFrame = 0;
  var nextTickFrame = 0;
  var deferQueue = [];
  var lastTime = Date.now();
  var frameTime;
  var frameTimeLimit;
  var loopEnabled = true;
  var eventForwarders = {};
  var eventHandler = new EventHandler();
  var options = {
    containerType: 'div',
    containerClass: 'famous-container',
    fpsCap: undefined,
    runLoop: true,
    appMode: true
  };
  var optionsManager = new OptionsManager(options);
  var MAX_DEFER_FRAME_TIME = 10;
  Engine.step = function step() {
    currentFrame++;
    nextTickFrame = currentFrame;
    var currentTime = Date.now();
    if (frameTimeLimit && currentTime - lastTime < frameTimeLimit)
      return ;
    var i = 0;
    frameTime = currentTime - lastTime;
    lastTime = currentTime;
    eventHandler.emit('prerender');
    var numFunctions = nextTickQueue.length;
    while (numFunctions--)
      nextTickQueue.shift()(currentFrame);
    while (deferQueue.length && Date.now() - currentTime < MAX_DEFER_FRAME_TIME) {
      deferQueue.shift().call(this);
    }
    for (i = 0; i < contexts.length; i++)
      contexts[i].update();
    eventHandler.emit('postrender');
  };
  function loop() {
    if (options.runLoop) {
      Engine.step();
      window.requestAnimationFrame(loop);
    } else
      loopEnabled = false;
  }
  window.requestAnimationFrame(loop);
  function handleResize(event) {
    for (var i = 0; i < contexts.length; i++) {
      contexts[i].emit('resize');
    }
    eventHandler.emit('resize');
  }
  window.addEventListener('resize', handleResize, false);
  handleResize();
  function initialize() {
    window.addEventListener('touchmove', function(event) {
      event.preventDefault();
    }, true);
    addRootClasses();
  }
  var initialized = false;
  function addRootClasses() {
    if (!document.body) {
      Engine.nextTick(addRootClasses);
      return ;
    }
    document.body.classList.add('famous-root');
    document.documentElement.classList.add('famous-root');
  }
  Engine.pipe = function pipe(target) {
    if (target.subscribe instanceof Function)
      return target.subscribe(Engine);
    else
      return eventHandler.pipe(target);
  };
  Engine.unpipe = function unpipe(target) {
    if (target.unsubscribe instanceof Function)
      return target.unsubscribe(Engine);
    else
      return eventHandler.unpipe(target);
  };
  Engine.on = function on(type, handler) {
    if (!(type in eventForwarders)) {
      eventForwarders[type] = eventHandler.emit.bind(eventHandler, type);
      addEngineListener(type, eventForwarders[type]);
    }
    return eventHandler.on(type, handler);
  };
  function addEngineListener(type, forwarder) {
    if (!document.body) {
      Engine.nextTick(addEventListener.bind(this, type, forwarder));
      return ;
    }
    document.body.addEventListener(type, forwarder);
  }
  Engine.emit = function emit(type, event) {
    return eventHandler.emit(type, event);
  };
  Engine.removeListener = function removeListener(type, handler) {
    return eventHandler.removeListener(type, handler);
  };
  Engine.getFPS = function getFPS() {
    return 1000 / frameTime;
  };
  Engine.setFPSCap = function setFPSCap(fps) {
    frameTimeLimit = Math.floor(1000 / fps);
  };
  Engine.getOptions = function getOptions(key) {
    return optionsManager.getOptions(key);
  };
  Engine.setOptions = function setOptions(options) {
    return optionsManager.setOptions.apply(optionsManager, arguments);
  };
  Engine.createContext = function createContext(el) {
    if (!initialized && options.appMode)
      Engine.nextTick(initialize);
    var needMountContainer = false;
    if (!el) {
      el = document.createElement(options.containerType);
      el.classList.add(options.containerClass);
      needMountContainer = true;
    }
    var context = new Context(el);
    Engine.registerContext(context);
    if (needMountContainer)
      mount(context, el);
    return context;
  };
  function mount(context, el) {
    if (!document.body) {
      Engine.nextTick(mount.bind(this, context, el));
      return ;
    }
    document.body.appendChild(el);
    context.emit('resize');
  }
  Engine.registerContext = function registerContext(context) {
    contexts.push(context);
    return context;
  };
  Engine.getContexts = function getContexts() {
    return contexts;
  };
  Engine.deregisterContext = function deregisterContext(context) {
    var i = contexts.indexOf(context);
    if (i >= 0)
      contexts.splice(i, 1);
  };
  Engine.nextTick = function nextTick(fn) {
    nextTickQueue.push(fn);
  };
  Engine.defer = function defer(fn) {
    deferQueue.push(fn);
  };
  optionsManager.on('change', function(data) {
    if (data.id === 'fpsCap')
      Engine.setFPSCap(data.value);
    else if (data.id === 'runLoop') {
      if (!loopEnabled && data.value) {
        loopEnabled = true;
        window.requestAnimationFrame(loop);
      }
    }
  });
  module.exports = Engine;
  global.define = __define;
  return module.exports;
});



(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.1/src/AnimationController", ["npm:famous@0.3.5/core/View", "github:ijzerenhein/famous-flex@0.3.1/src/LayoutController", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/core/Modifier", "npm:famous@0.3.5/modifiers/StateModifier", "npm:famous@0.3.5/core/RenderNode", "npm:famous@0.3.5/utilities/Timer", "npm:famous@0.3.5/transitions/Easing"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var View = require("npm:famous@0.3.5/core/View");
    var LayoutController = require("github:ijzerenhein/famous-flex@0.3.1/src/LayoutController");
    var Transform = require("npm:famous@0.3.5/core/Transform");
    var Modifier = require("npm:famous@0.3.5/core/Modifier");
    var StateModifier = require("npm:famous@0.3.5/modifiers/StateModifier");
    var RenderNode = require("npm:famous@0.3.5/core/RenderNode");
    var Timer = require("npm:famous@0.3.5/utilities/Timer");
    var Easing = require("npm:famous@0.3.5/transitions/Easing");
    function AnimationController(options) {
      View.apply(this, arguments);
      _createLayout.call(this);
      if (options) {
        this.setOptions(options);
      }
    }
    AnimationController.prototype = Object.create(View.prototype);
    AnimationController.prototype.constructor = AnimationController;
    AnimationController.Animation = {
      Slide: {
        Left: function(show, size) {
          return {transform: Transform.translate(show ? size[0] : -size[0], 0, 0)};
        },
        Right: function(show, size) {
          return {transform: Transform.translate(show ? -size[0] : size[0], 0, 0)};
        },
        Up: function(show, size) {
          return {transform: Transform.translate(0, show ? size[1] : -size[1], 0)};
        },
        Down: function(show, size) {
          return {transform: Transform.translate(0, show ? -size[1] : size[1], 0)};
        }
      },
      Fade: function(show, size, opacity) {
        return {opacity: (opacity === undefined) ? 0 : opacity};
      },
      Zoom: function(show, size, scale) {
        return {
          transform: Transform.scale(scale ? scale[0] : 0.5, scale ? scale[1] : 0.5, 1),
          align: [0.5, 0.5],
          origin: [0.5, 0.5]
        };
      }
    };
    AnimationController.DEFAULT_OPTIONS = {
      transition: {
        duration: 400,
        curve: Easing.inOutQuad
      },
      animation: AnimationController.Animation.Fade,
      show: {},
      hide: {},
      transfer: {zIndex: 10},
      zIndexOffset: 0
    };
    var ItemState = {
      NONE: 0,
      HIDE: 1,
      HIDING: 2,
      SHOW: 3,
      SHOWING: 4,
      VISIBLE: 5,
      QUEUED: 6
    };
    function ViewStackLayout(context, options) {
      var set = {
        size: context.size,
        translate: [0, 0, 0]
      };
      var views = context.get('views');
      var transferables = context.get('transferables');
      for (var i = 0; i < Math.min(views.length, 2); i++) {
        var item = this._viewStack[i];
        switch (item.state) {
          case ItemState.HIDE:
          case ItemState.HIDING:
          case ItemState.VISIBLE:
          case ItemState.SHOW:
          case ItemState.SHOWING:
            var view = views[i];
            context.set(view, set);
            for (var j = 0; j < transferables.length; j++) {
              for (var k = 0; k < item.transferables.length; k++) {
                if (transferables[j].renderNode === item.transferables[k].renderNode) {
                  context.set(transferables[j], {
                    translate: [0, 0, set.translate[2]],
                    size: [context.size[0], context.size[1]]
                  });
                }
              }
            }
            set.translate[2] += options.zIndexOffset;
            break;
        }
      }
    }
    function _createLayout() {
      this._renderables = {
        views: [],
        transferables: []
      };
      this._viewStack = [];
      this.layout = new LayoutController({
        layout: ViewStackLayout.bind(this),
        layoutOptions: this.options,
        dataSource: this._renderables
      });
      this.add(this.layout);
      this.layout.on('layoutend', _startAnimations.bind(this));
    }
    function _getViewSpec(item, view, id, callback) {
      if (!item.view) {
        return ;
      }
      var spec = view.getSpec(id);
      if (spec) {
        callback(spec);
      } else {
        Timer.after(_getViewSpec.bind(this, item, view, id, callback), 1);
      }
    }
    function _getTransferable(item, view, id) {
      if (view.getTransferable) {
        return view.getTransferable(id);
      }
      if (view.getSpec && view.get && view.replace) {
        if (view.get(id) !== undefined) {
          return {
            get: function() {
              return view.get(id);
            },
            show: function(renderable) {
              view.replace(id, renderable);
            },
            getSpec: _getViewSpec.bind(this, item, view, id)
          };
        }
      }
      if (view.layout) {
        return _getTransferable.call(this, item, view.layout, id);
      }
    }
    function _startTransferableAnimations(item, prevItem) {
      for (var sourceId in item.options.transfer.items) {
        _startTransferableAnimation.call(this, item, prevItem, sourceId);
      }
    }
    function _startTransferableAnimation(item, prevItem, sourceId) {
      var target = item.options.transfer.items[sourceId];
      var transferable = {};
      transferable.source = _getTransferable.call(this, prevItem, prevItem.view, sourceId);
      if (Array.isArray(target)) {
        for (var i = 0; i < target.length; i++) {
          transferable.target = _getTransferable.call(this, item, item.view, target[i]);
          if (transferable.target) {
            break;
          }
        }
      } else {
        transferable.target = _getTransferable.call(this, item, item.view, target);
      }
      if (transferable.source && transferable.target) {
        transferable.source.getSpec(function(sourceSpec) {
          transferable.originalSource = transferable.source.get();
          transferable.source.show(new RenderNode(new Modifier(sourceSpec)));
          transferable.originalTarget = transferable.target.get();
          var targetNode = new RenderNode(new Modifier({opacity: 0}));
          targetNode.add(transferable.originalTarget);
          transferable.target.show(targetNode);
          var zIndexMod = new Modifier({transform: Transform.translate(0, 0, item.options.transfer.zIndex)});
          var mod = new StateModifier(sourceSpec);
          transferable.renderNode = new RenderNode(zIndexMod);
          transferable.renderNode.add(mod).add(transferable.originalSource);
          item.transferables.push(transferable);
          this._renderables.transferables.push(transferable.renderNode);
          this.layout.reflowLayout();
          Timer.after(function() {
            transferable.target.getSpec(function(targetSpec, transition) {
              mod.halt();
              if (sourceSpec.transform || targetSpec.transform) {
                mod.setTransform(targetSpec.transform || Transform.identity, transition || item.options.transfer.transition);
              }
              if ((sourceSpec.opacity !== undefined) || (targetSpec.opacity !== undefined)) {
                mod.setOpacity((targetSpec.opacity === undefined) ? 1 : targetSpec.opacity, transition || item.options.transfer.transition);
              }
              if (sourceSpec.size || targetSpec.size) {
                mod.setSize(targetSpec.size || sourceSpec.size, transition || item.options.transfer.transition);
              }
            }, true);
          }, 1);
        }.bind(this), false);
      }
    }
    function _endTransferableAnimations(item) {
      for (var j = 0; j < item.transferables.length; j++) {
        var transferable = item.transferables[j];
        for (var i = 0; i < this._renderables.transferables.length; i++) {
          if (this._renderables.transferables[i] === transferable.renderNode) {
            this._renderables.transferables.splice(i, 1);
            break;
          }
        }
        transferable.source.show(transferable.originalSource);
        transferable.target.show(transferable.originalTarget);
      }
      item.transferables = [];
      this.layout.reflowLayout();
    }
    function _startAnimations(event) {
      var prevItem;
      for (var i = 0; i < this._viewStack.length; i++) {
        var item = this._viewStack[i];
        switch (item.state) {
          case ItemState.HIDE:
            item.state = ItemState.HIDING;
            _startAnimation.call(this, item, prevItem, event.size, false);
            _updateState.call(this);
            break;
          case ItemState.SHOW:
            item.state = ItemState.SHOWING;
            _startAnimation.call(this, item, prevItem, event.size, true);
            _updateState.call(this);
            break;
        }
        prevItem = item;
      }
    }
    function _startAnimation(item, prevItem, size, show) {
      var animation = show ? item.options.show.animation : item.options.hide.animation;
      var spec = animation ? animation(show, size) : {};
      item.mod.halt();
      var callback;
      if (show) {
        callback = item.showCallback;
        if (spec.transform) {
          item.mod.setTransform(spec.transform);
          item.mod.setTransform(Transform.identity, item.options.show.transition, callback);
          callback = undefined;
        }
        if (spec.opacity !== undefined) {
          item.mod.setOpacity(spec.opacity);
          item.mod.setOpacity(1, item.options.show.transition, callback);
          callback = undefined;
        }
        if (spec.align) {
          item.mod.setAlign(spec.align);
        }
        if (spec.origin) {
          item.mod.setOrigin(spec.origin);
        }
        if (prevItem) {
          _startTransferableAnimations.call(this, item, prevItem);
        }
        if (callback) {
          callback();
        }
      } else {
        callback = item.hideCallback;
        if (spec.transform) {
          item.mod.setTransform(spec.transform, item.options.hide.transition, callback);
          callback = undefined;
        }
        if (spec.opacity !== undefined) {
          item.mod.setOpacity(spec.opacity, item.options.hide.transition, callback);
          callback = undefined;
        }
        if (callback) {
          callback();
        }
      }
    }
    function _createItem(view, options, callback) {
      var item = {
        view: view,
        mod: new StateModifier(),
        state: ItemState.QUEUED,
        options: {
          show: {
            transition: this.options.show.transition || this.options.transition,
            animation: this.options.show.animation || this.options.animation
          },
          hide: {
            transition: this.options.hide.transition || this.options.transition,
            animation: this.options.hide.animation || this.options.animation
          },
          transfer: {
            transition: this.options.transfer.transition || this.options.transition,
            items: this.options.transfer.items || {},
            zIndex: this.options.transfer.zIndex
          }
        },
        callback: callback,
        transferables: []
      };
      if (options) {
        item.options.show.transition = (options.show ? options.show.transition : undefined) || options.transition || item.options.show.transition;
        item.options.show.animation = (options.show ? options.show.animation : undefined) || options.animation || item.options.show.animation;
        item.options.transfer.transition = (options.transfer ? options.transfer.transition : undefined) || options.transition || item.options.transfer.transition;
        item.options.transfer.items = (options.transfer ? options.transfer.items : undefined) || item.options.transfer.items;
        item.options.transfer.zIndex = (options.transfer && (options.transfer.zIndex !== undefined)) ? options.transfer.zIndex : item.options.transfer.zIndex;
      }
      item.node = new RenderNode(item.mod);
      item.node.add(view);
      return item;
    }
    function _updateState() {
      var prevItem;
      var invalidated = false;
      for (var i = 0; i < Math.min(this._viewStack.length, 2); i++) {
        var item = this._viewStack[i];
        if (item.state === ItemState.QUEUED) {
          if (!prevItem || (prevItem.state === ItemState.VISIBLE) || (prevItem.state === ItemState.HIDING)) {
            if (prevItem && (prevItem.state === ItemState.VISIBLE)) {
              prevItem.state = ItemState.HIDE;
            }
            item.state = ItemState.SHOW;
            invalidated = true;
          }
          break;
        } else if ((item.state === ItemState.VISIBLE) && item.hide) {
          item.state = ItemState.HIDE;
        }
        if ((item.state === ItemState.SHOW) || (item.state === ItemState.HIDE)) {
          this.layout.reflowLayout();
        }
        prevItem = item;
      }
      if (invalidated) {
        _updateState.call(this);
        this.layout.reflowLayout();
      }
    }
    AnimationController.prototype.show = function(renderable, options, callback) {
      if (!renderable) {
        return this.hide(options, callback);
      }
      var item = this._viewStack.length ? this._viewStack[this._viewStack.length - 1] : undefined;
      if (item && (item.view === renderable)) {
        item.hide = false;
        return this;
      }
      if (item && (item.state !== ItemState.HIDING) && options) {
        item.options.hide.transition = (options.hide ? options.hide.transition : undefined) || options.transition || item.options.hide.transition;
        item.options.hide.animation = (options.hide ? options.hide.animation : undefined) || options.animation || item.options.hide.animation;
      }
      item = _createItem.call(this, renderable, options, callback);
      item.showCallback = function() {
        item.state = ItemState.VISIBLE;
        _updateState.call(this);
        _endTransferableAnimations.call(this, item);
        if (callback) {
          callback();
        }
      }.bind(this);
      item.hideCallback = function() {
        var index = this._viewStack.indexOf(item);
        this._renderables.views.splice(index, 1);
        this._viewStack.splice(index, 1);
        item.view = undefined;
        _updateState.call(this);
      }.bind(this);
      this._renderables.views.push(item.node);
      this._viewStack.push(item);
      _updateState.call(this);
      return this;
    };
    AnimationController.prototype.hide = function(options, callback) {
      var item = this._viewStack.length ? this._viewStack[this._viewStack.length - 1] : undefined;
      if (!item || (item.state === ItemState.HIDING)) {
        return this;
      }
      item.hide = true;
      if (options) {
        item.options.hide.transition = (options.hide ? options.hide.transition : undefined) || options.transition || item.options.hide.transition;
        item.options.hide.animation = (options.hide ? options.hide.animation : undefined) || options.animation || item.options.hide.animation;
      }
      item.hideCallback = function() {
        var index = this._viewStack.indexOf(item);
        this._renderables.views.splice(index, 1);
        this._viewStack.splice(index, 1);
        item.view = undefined;
        _updateState.call(this);
        if (callback) {
          callback();
        }
      }.bind(this);
      _updateState.call(this);
      return this;
    };
    AnimationController.prototype.halt = function() {
      for (var i = 0; i < this._viewStack.length; i++) {
        var item = this._viewStack[this._viewStack.length - 1];
        if ((item.state === ItemState.QUEUED) || (item.state === ItemState.SHOW)) {
          this._renderables.views.splice(this._viewStack.length - 1, 1);
          this._viewStack.splice(this._viewStack.length - 1, 1);
          item.view = undefined;
        } else {
          break;
        }
      }
      return this;
    };
    AnimationController.prototype.get = function() {
      for (var i = 0; i < this._viewStack.length; i++) {
        var item = this._viewStack[i];
        if ((item.state === ItemState.VISIBLE) || (item.state === ItemState.SHOW) || (item.state === ItemState.SHOWING)) {
          return item.view;
        }
      }
      return undefined;
    };
    module.exports = AnimationController;
  }).call(__exports, __require, __exports, __module);
});


})();
System.register("npm:lodash@3.7.0", ["npm:lodash@3.7.0/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:lodash@3.7.0/index");
  global.define = __define;
  return module.exports;
});



System.register("core/Controller", ["npm:lodash@3.7.0", "github:angular/di.js@master", "core/Router", "utils/objectHelper", "npm:famous@0.3.5/core/Context", "npm:famous@0.3.5/Views/RenderController", "npm:famous@0.3.5/core/EventHandler", "github:ijzerenhein/famous-flex@0.3.1/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "core/Controller";
  var _,
      Inject,
      annotate,
      Router,
      ObjectHelper,
      Context,
      RenderController,
      EventHandler,
      AnimationController,
      Controller;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }, function($__m) {
      Inject = $__m.Inject;
      annotate = $__m.annotate;
    }, function($__m) {
      Router = $__m.Router;
    }, function($__m) {
      ObjectHelper = $__m.default;
    }, function($__m) {
      Context = $__m.default;
    }, function($__m) {
      RenderController = $__m.default;
    }, function($__m) {
      EventHandler = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      Controller = $__export("Controller", (function() {
        var Controller = function Controller(router, context, spec) {
          this.spec = spec;
          this.router = router;
          this.context = context;
          this._eventOutput = new EventHandler();
          ObjectHelper.bindAllMethods(this, this);
          var routeName = Object.getPrototypeOf(this).constructor.name.replace('Controller', '');
          routeName += "/:method";
          this.router.add(routeName, this.onRouteCalled);
        };
        return ($traceurRuntime.createClass)(Controller, {
          on: function(event, handler) {
            this._eventOutput.on(event, handler);
          },
          onRouteCalled: function(route) {
            var $__0 = this;
            if (typeof(this[route.method]) == "function") {
              var result = this[route.method].apply(this, route.values);
              if (result) {
                this._eventOutput.emit("renderstart", route.method);
                this.context.show(result, _.extend(route.spec, this.spec), (function() {
                  $__0._eventOutput.emit("renderend", route.method);
                }));
              }
            } else {
              console.log("Route does not exist!");
            }
          }
        }, {});
      }()));
      annotate(Controller, new Inject(Router));
      annotate(Controller, new Inject(AnimationController));
    }
  };
});



System.register("utils/objectHelper", ["npm:lodash@3.7.0"], function($__export) {
  "use strict";
  var __moduleName = "utils/objectHelper";
  var _;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }],
    execute: function() {
      $__export('default', (function() {
        var ObjectHelper = function ObjectHelper() {};
        return ($traceurRuntime.createClass)(ObjectHelper, {}, {
          hideMethodsAndPrivatePropertiesFromObject: function(object) {
            for (var propName in object) {
              var prototype = Object.getPrototypeOf(object);
              var descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, propName) : undefined;
              if (descriptor && (descriptor.get || descriptor.set) && !propName.startsWith('_')) {
                continue;
              }
              var property = object[propName];
              if (typeof property === 'function' || propName.startsWith('_')) {
                ObjectHelper.hidePropertyFromObject(object, propName);
              }
            }
          },
          hideMethodsFromObject: function(object) {
            for (var propName in object) {
              var property = object[propName];
              if (typeof property === 'function') {
                ObjectHelper.hidePropertyFromObject(object, propName);
              }
            }
          },
          hidePropertyFromObject: function(object, propName) {
            var prototype = object;
            var descriptor = Object.getOwnPropertyDescriptor(object, propName);
            while (!descriptor) {
              prototype = Object.getPrototypeOf(prototype);
              if (prototype.constructor.name === 'Object' || prototype.constructor.name === 'Array') {
                return ;
              }
              descriptor = Object.getOwnPropertyDescriptor(prototype, propName);
            }
            descriptor.enumerable = false;
            Object.defineProperty(prototype, propName, descriptor);
            Object.defineProperty(object, propName, descriptor);
          },
          hideAllPropertiesFromObject: function(object) {
            for (var propName in object) {
              ObjectHelper.hidePropertyFromObject(object, propName);
            }
          },
          addHiddenPropertyToObject: function(object, propName, prop) {
            var writable = arguments[3] !== (void 0) ? arguments[3] : true;
            var useAccessors = arguments[4] !== (void 0) ? arguments[4] : true;
            return ObjectHelper.addPropertyToObject(object, propName, prop, false, writable, undefined, useAccessors);
          },
          addPropertyToObject: function(object, propName, prop) {
            var enumerable = arguments[3] !== (void 0) ? arguments[3] : true;
            var writable = arguments[4] !== (void 0) ? arguments[4] : true;
            var setCallback = arguments[5] !== (void 0) ? arguments[5] : null;
            var useAccessors = arguments[6] !== (void 0) ? arguments[6] : true;
            if (!writable || !useAccessors) {
              var descriptor = {
                enumerable: enumerable,
                writable: writable,
                value: prop
              };
              Object.defineProperty(object, propName, descriptor);
            } else {
              ObjectHelper.addGetSetPropertyWithShadow(object, propName, prop, enumerable, writable, setCallback);
            }
          },
          addGetSetPropertyWithShadow: function(object, propName, prop) {
            var enumerable = arguments[3] !== (void 0) ? arguments[3] : true;
            var writable = arguments[4] !== (void 0) ? arguments[4] : true;
            var setCallback = arguments[5] !== (void 0) ? arguments[5] : null;
            ObjectHelper.buildPropertyShadow(object, propName, prop);
            ObjectHelper.buildGetSetProperty(object, propName, enumerable, writable, setCallback);
          },
          buildPropertyShadow: function(object, propName, prop) {
            var shadow = {};
            if (!object || !propName) {
              debugger;
            }
            try {
              if ('shadow' in object) {
                shadow = object['shadow'];
              }
            } catch (error) {
              debugger;
            }
            shadow[propName] = prop;
            Object.defineProperty(object, 'shadow', {
              writable: true,
              configurable: true,
              enumerable: false,
              value: shadow
            });
          },
          buildGetSetProperty: function(object, propName) {
            var enumerable = arguments[2] !== (void 0) ? arguments[2] : true;
            var writable = arguments[3] !== (void 0) ? arguments[3] : true;
            var setCallback = arguments[4] !== (void 0) ? arguments[4] : null;
            var descriptor = {
              enumerable: enumerable,
              configurable: true,
              get: function() {
                return object['shadow'][propName];
              },
              set: function(value) {
                if (writable) {
                  object['shadow'][propName] = value;
                  if (setCallback && typeof setCallback === 'function') {
                    setCallback({
                      propertyName: propName,
                      newValue: value
                    });
                  }
                } else {
                  throw new ReferenceError('Attempted to write to non-writable property "' + propName + '".');
                }
              }
            };
            Object.defineProperty(object, propName, descriptor);
          },
          bindAllMethods: function(object, bindTarget) {
            var methodNames = ObjectHelper.getMethodNames(object);
            methodNames.forEach(function(name) {
              object[name] = object[name].bind(bindTarget);
            });
          },
          getMethodNames: function(object) {
            var methodNames = arguments[1] !== (void 0) ? arguments[1] : [];
            var propNames = Object.getOwnPropertyNames(object).filter(function(c) {
              return typeof object[c] === 'function';
            });
            methodNames = methodNames.concat(propNames);
            var prototype = Object.getPrototypeOf(object);
            if (prototype.constructor.name !== 'Object' && prototype.constructor.name !== 'Array') {
              return ObjectHelper.getMethodNames(prototype, methodNames);
            }
            return methodNames;
          },
          getEnumerableProperties: function(object) {
            return ObjectHelper.getPrototypeEnumerableProperties(object, object);
          },
          getPrototypeEnumerableProperties: function(rootObject, prototype) {
            var result = {};
            var propNames = Object.keys(prototype);
            for (var $__1 = propNames.values()[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__2 = void 0; !($__2 = $__1.next()).done; ) {
              var name = $__2.value;
              {
                var value = rootObject[name];
                if (value !== null && value !== undefined && typeof value !== 'function') {
                  if (typeof value == 'object') {
                    result[name] = ObjectHelper.getEnumerableProperties(value);
                  } else {
                    result[name] = value;
                  }
                }
              }
            }
            var descriptorNames = Object.getOwnPropertyNames(prototype);
            descriptorNames = descriptorNames.filter(function(name) {
              return propNames.indexOf(name) < 0;
            });
            for (var $__3 = descriptorNames.values()[$traceurRuntime.toProperty(Symbol.iterator)](),
                $__4 = void 0; !($__4 = $__3.next()).done; ) {
              var name$__5 = $__4.value;
              {
                var descriptor = Object.getOwnPropertyDescriptor(prototype, name$__5);
                if (descriptor && descriptor.enumerable) {
                  var value$__6 = rootObject[name$__5];
                  if (value$__6 !== null && value$__6 !== undefined && typeof value$__6 !== 'function') {
                    if (typeof value$__6 == 'object') {
                      result[name$__5] = ObjectHelper.getEnumerableProperties(value$__6);
                    } else {
                      result[name$__5] = value$__6;
                    }
                  }
                }
              }
            }
            var superPrototype = Object.getPrototypeOf(prototype);
            if (superPrototype.constructor.name !== 'Object' && superPrototype.constructor.name !== 'Array') {
              var prototypeEnumerables = ObjectHelper.getPrototypeEnumerableProperties(rootObject, superPrototype);
              _.merge(result, prototypeEnumerables);
            }
            return result;
          }
        });
      }()));
    }
  };
});



System.register("controllers/HomeController", ["npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Surface", "core/Controller", "views/ProfileView", "views/FullImageView", "views/NavBarView", "views/ChupPlayView", "views/NewChupsView", "views/MainFlippedView", "controllers/PlayController", "npm:famous@0.3.5/transitions/Easing", "github:ijzerenhein/famous-flex@0.3.1/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "controllers/HomeController";
  var Engine,
      Surface,
      Controller,
      ProfileView,
      FullImageView,
      NavBarView,
      ChupPlayView,
      NewChupsView,
      MainFlippedView,
      PlayController,
      Easing,
      AnimationController;
  return {
    setters: [function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Surface = $__m.default;
    }, function($__m) {
      Controller = $__m.Controller;
    }, function($__m) {
      ProfileView = $__m.ProfileView;
    }, function($__m) {
      FullImageView = $__m.FullImageView;
    }, function($__m) {
      NavBarView = $__m.NavBarView;
    }, function($__m) {
      ChupPlayView = $__m.ChupPlayView;
    }, function($__m) {
      NewChupsView = $__m.NewChupsView;
    }, function($__m) {
      MainFlippedView = $__m.MainFlippedView;
    }, function($__m) {
      PlayController = $__m.default;
    }, function($__m) {
      Easing = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      $__export('default', (function($__super) {
        var HomeController = function HomeController(router, context) {
          var $__0 = this;
          $traceurRuntime.superConstructor(HomeController).call(this, router, context, {transfer: {
              transition: {
                duration: 500,
                curve: Easing.inOutElastic
              },
              zIndex: 1000,
              items: {
                'topleft': ['topleft', 'chupheader1'],
                'topright': ['topright', 'chupheader2'],
                'bottomleft': ['bottomleft', 'chupheader3'],
                'bottomright': ['bottomright', 'chupheader4'],
                'chupheader1': ['topleft', 'chupheader1'],
                'chupheader2': ['topright', 'chupheader2'],
                'chupheader3': ['bottomleft', 'chupheader3'],
                'chupheader4': ['bottomright', 'chupheader4']
              }
            }});
          this.mainView = new NewChupsView();
          this.mainView.on('play', (function(id) {
            $__0.router.go(PlayController, 'Chup', {id: id});
          }));
          this.flip = new MainFlippedView();
          this.on('renderend', (function(arg) {
            console.log(arg);
          }));
        };
        return ($traceurRuntime.createClass)(HomeController, {
          Main: function() {
            return this.mainView;
          },
          Settings: function() {
            this.flip.setAngle(Math.PI, {
              curve: 'easeOutBounce',
              duration: 500
            });
            return this.flip;
          }
        }, {}, $__super);
      }(Controller)));
    }
  };
});



System.register("core/Router", ["utils/objectHelper"], function($__export) {
  "use strict";
  var __moduleName = "core/Router";
  var ObjectHelper,
      Router;
  return {
    setters: [function($__m) {
      ObjectHelper = $__m.default;
    }],
    execute: function() {
      Router = $__export("Router", (function() {
        var Router = function Router() {
          ObjectHelper.bindAllMethods(this, this);
          this.controllers = [];
          this.defaultController = 'Home';
          this.defaultMethod = 'Index';
        };
        return ($traceurRuntime.createClass)(Router, {
          run: function() {},
          setDefault: function(controller, method) {},
          add: function(route, handler) {},
          go: function(controller, method, params) {}
        }, {});
      }()));
    }
  };
});



System.register("core/App", ["github:angular/di.js@master", "core/Router"], function($__export) {
  "use strict";
  var __moduleName = "core/App";
  var Inject,
      annotate,
      Router,
      App;
  return {
    setters: [function($__m) {
      Inject = $__m.Inject;
      annotate = $__m.annotate;
    }, function($__m) {
      Router = $__m.Router;
    }],
    execute: function() {
      App = $__export("App", (function() {
        var App = function App(router) {
          router.run();
        };
        return ($traceurRuntime.createClass)(App, {}, {});
      }()));
      annotate(App, new Inject(Router));
    }
  };
});



System.register("DefaultApp", ["github:angular/di.js@master", "core/App", "controllers/HomeController", "controllers/PlayController", "npm:famous@0.3.5/transitions/Easing", "github:ijzerenhein/famous-flex@0.3.1/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "DefaultApp";
  var Inject,
      annotate,
      App,
      HomeController,
      PlayController,
      Easing,
      AnimationController,
      DefaultApp;
  return {
    setters: [function($__m) {
      Inject = $__m.Inject;
      annotate = $__m.annotate;
    }, function($__m) {
      App = $__m.App;
    }, function($__m) {
      HomeController = $__m.default;
    }, function($__m) {
      PlayController = $__m.default;
    }, function($__m) {
      Easing = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      DefaultApp = $__export("DefaultApp", (function($__super) {
        var DefaultApp = function DefaultApp(router, homeController, playController) {
          router.setDefault(homeController, 'Main');
          router.setControllerSpecs({
            HomeController: {
              controllers: [{
                transition: {
                  duration: 500,
                  curve: Easing.outBack
                },
                animation: AnimationController.Animation.Slide.Up,
                activeFrom: ['PlayController']
              }],
              methods: {
                next: {
                  transition: {
                    duration: 500,
                    curve: Easing.outBack
                  },
                  animation: AnimationController.Animation.Slide.Right
                },
                previous: {
                  transition: {
                    duration: 500,
                    curve: Easing.outBack
                  },
                  animation: AnimationController.Animation.Slide.Left
                }
              }
            },
            PlayController: {controllers: [{
                transition: {
                  duration: 500,
                  curve: Easing.outBack
                },
                animation: AnimationController.Animation.Slide.Down,
                activeFrom: ['HomeController']
              }]}
          });
          $traceurRuntime.superConstructor(DefaultApp).call(this, router);
        };
        return ($traceurRuntime.createClass)(DefaultApp, {}, {}, $__super);
      }(App)));
      annotate(DefaultApp, new Inject(HomeController));
      annotate(DefaultApp, new Inject(PlayController));
    }
  };
});



System.register("main", ["DefaultApp", "npm:famous@0.3.5/core/Engine", "settings", "DefaultContext"], function($__export) {
  "use strict";
  var __moduleName = "main";
  var DefaultApp,
      Engine,
      DefaultDataSource,
      ReCreateDefaultContext;
  return {
    setters: [function($__m) {
      DefaultApp = $__m.DefaultApp;
    }, function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      DefaultDataSource = $__m.DefaultDataSource;
    }, function($__m) {
      ReCreateDefaultContext = $__m.ReCreateDefaultContext;
    }],
    execute: function() {
      ReCreateDefaultContext(DefaultDataSource).get(DefaultApp);
    }
  };
});



(function() {
  var loader = System;
  var hasOwnProperty = loader.global.hasOwnProperty;
  var moduleGlobals = {};
  var curGlobalObj;
  var ignoredGlobalProps;
  if (typeof indexOf == 'undefined')
    indexOf = Array.prototype.indexOf;
  System.set("@@global-helpers", System.newModule({
    prepareGlobal: function(moduleName, deps) {
      for (var i = 0; i < deps.length; i++) {
        var moduleGlobal = moduleGlobals[deps[i]];
        if (moduleGlobal)
          for (var m in moduleGlobal)
            loader.global[m] = moduleGlobal[m];
      }
      curGlobalObj = {};
      ignoredGlobalProps = ["indexedDB", "sessionStorage", "localStorage", "clipboardData", "frames", "webkitStorageInfo"];
      for (var g in loader.global) {
        if (indexOf.call(ignoredGlobalProps, g) != -1) { continue; }
        if (!hasOwnProperty || loader.global.hasOwnProperty(g)) {
          try {
            curGlobalObj[g] = loader.global[g];
          } catch (e) {
            ignoredGlobalProps.push(g);
          }
        }
      }
    },
    retrieveGlobal: function(moduleName, exportName, init) {
      var singleGlobal;
      var multipleExports;
      var exports = {};
      if (init) {
        var depModules = [];
        for (var i = 0; i < deps.length; i++)
          depModules.push(require(deps[i]));
        singleGlobal = init.apply(loader.global, depModules);
      }
      else if (exportName) {
        var firstPart = exportName.split(".")[0];
        singleGlobal = eval.call(loader.global, exportName);
        exports[firstPart] = loader.global[firstPart];
      }
      else {
        for (var g in loader.global) {
          if (indexOf.call(ignoredGlobalProps, g) != -1)
            continue;
          if ((!hasOwnProperty || loader.global.hasOwnProperty(g)) && g != loader.global && curGlobalObj[g] != loader.global[g]) {
            exports[g] = loader.global[g];
            if (singleGlobal) {
              if (singleGlobal !== loader.global[g])
                multipleExports = true;
            }
            else if (singleGlobal !== false) {
              singleGlobal = loader.global[g];
            }
          }
        }
      }
      moduleGlobals[moduleName] = exports;
      return multipleExports ? exports : singleGlobal;
    }
  }));
})();

});
//# sourceMappingURL=bundle.js.map