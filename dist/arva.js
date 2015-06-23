/* */ 
"format global";
"exports $traceurRuntime";
(function(global) {
  'use strict';
  if (global.$traceurRuntime) {
    return ;
  }
  var $Object = Object;
  var $TypeError = TypeError;
  var $create = $Object.create;
  var $defineProperties = $Object.defineProperties;
  var $defineProperty = $Object.defineProperty;
  var $freeze = $Object.freeze;
  var $getOwnPropertyDescriptor = $Object.getOwnPropertyDescriptor;
  var $getOwnPropertyNames = $Object.getOwnPropertyNames;
  var $keys = $Object.keys;
  var $hasOwnProperty = $Object.prototype.hasOwnProperty;
  var $toString = $Object.prototype.toString;
  var $preventExtensions = Object.preventExtensions;
  var $seal = Object.seal;
  var $isExtensible = Object.isExtensible;
  var $apply = Function.prototype.call.bind(Function.prototype.apply);
  function $bind(operand, thisArg, args) {
    var argArray = [thisArg];
    for (var i = 0; i < args.length; i++) {
      argArray[i + 1] = args[i];
    }
    var func = $apply(Function.prototype.bind, operand, argArray);
    return func;
  }
  function $construct(func, argArray) {
    var object = new ($bind(func, null, argArray));
    return object;
  }
  var counter = 0;
  function newUniqueString() {
    return '__$' + Math.floor(Math.random() * 1e9) + '$' + ++counter + '$__';
  }
  var privateNames = $create(null);
  function isPrivateName(s) {
    return privateNames[s];
  }
  function createPrivateName() {
    var s = newUniqueString();
    privateNames[s] = true;
    return s;
  }
  var CONTINUATION_TYPE = Object.create(null);
  function createContinuation(operand, thisArg, argsArray) {
    return [CONTINUATION_TYPE, operand, thisArg, argsArray];
  }
  function isContinuation(object) {
    return object && object[0] === CONTINUATION_TYPE;
  }
  var isTailRecursiveName = null;
  function setupProperTailCalls() {
    isTailRecursiveName = createPrivateName();
    Function.prototype.call = initTailRecursiveFunction(function call(thisArg) {
      var result = tailCall(function(thisArg) {
        var argArray = [];
        for (var i = 1; i < arguments.length; ++i) {
          argArray[i - 1] = arguments[i];
        }
        var continuation = createContinuation(this, thisArg, argArray);
        return continuation;
      }, this, arguments);
      return result;
    });
    Function.prototype.apply = initTailRecursiveFunction(function apply(thisArg, argArray) {
      var result = tailCall(function(thisArg, argArray) {
        var continuation = createContinuation(this, thisArg, argArray);
        return continuation;
      }, this, arguments);
      return result;
    });
  }
  function initTailRecursiveFunction(func) {
    if (isTailRecursiveName === null) {
      setupProperTailCalls();
    }
    func[isTailRecursiveName] = true;
    return func;
  }
  function isTailRecursive(func) {
    return !!func[isTailRecursiveName];
  }
  function tailCall(func, thisArg, argArray) {
    var continuation = argArray[0];
    if (isContinuation(continuation)) {
      continuation = $apply(func, thisArg, continuation[3]);
      return continuation;
    }
    continuation = createContinuation(func, thisArg, argArray);
    while (true) {
      if (isTailRecursive(func)) {
        continuation = $apply(func, continuation[2], [continuation]);
      } else {
        continuation = $apply(func, continuation[2], continuation[3]);
      }
      if (!isContinuation(continuation)) {
        return continuation;
      }
      func = continuation[1];
    }
  }
  function construct() {
    var object;
    if (isTailRecursive(this)) {
      object = $construct(this, [createContinuation(null, null, arguments)]);
    } else {
      object = $construct(this, arguments);
    }
    return object;
  }
  var $traceurRuntime = {
    initTailRecursiveFunction: initTailRecursiveFunction,
    call: tailCall,
    continuation: createContinuation,
    construct: construct
  };
  (function() {
    function nonEnum(value) {
      return {
        configurable: true,
        enumerable: false,
        value: value,
        writable: true
      };
    }
    var method = nonEnum;
    var symbolInternalProperty = newUniqueString();
    var symbolDescriptionProperty = newUniqueString();
    var symbolDataProperty = newUniqueString();
    var symbolValues = $create(null);
    function isShimSymbol(symbol) {
      return typeof symbol === 'object' && symbol instanceof SymbolValue;
    }
    function typeOf(v) {
      if (isShimSymbol(v))
        return 'symbol';
      return typeof v;
    }
    function Symbol(description) {
      var value = new SymbolValue(description);
      if (!(this instanceof Symbol))
        return value;
      throw new TypeError('Symbol cannot be new\'ed');
    }
    $defineProperty(Symbol.prototype, 'constructor', nonEnum(Symbol));
    $defineProperty(Symbol.prototype, 'toString', method(function() {
      var symbolValue = this[symbolDataProperty];
      return symbolValue[symbolInternalProperty];
    }));
    $defineProperty(Symbol.prototype, 'valueOf', method(function() {
      var symbolValue = this[symbolDataProperty];
      if (!symbolValue)
        throw TypeError('Conversion from symbol to string');
      if (!getOption('symbols'))
        return symbolValue[symbolInternalProperty];
      return symbolValue;
    }));
    function SymbolValue(description) {
      var key = newUniqueString();
      $defineProperty(this, symbolDataProperty, {value: this});
      $defineProperty(this, symbolInternalProperty, {value: key});
      $defineProperty(this, symbolDescriptionProperty, {value: description});
      freeze(this);
      symbolValues[key] = this;
    }
    $defineProperty(SymbolValue.prototype, 'constructor', nonEnum(Symbol));
    $defineProperty(SymbolValue.prototype, 'toString', {
      value: Symbol.prototype.toString,
      enumerable: false
    });
    $defineProperty(SymbolValue.prototype, 'valueOf', {
      value: Symbol.prototype.valueOf,
      enumerable: false
    });
    var hashProperty = createPrivateName();
    var hashPropertyDescriptor = {value: undefined};
    var hashObjectProperties = {
      hash: {value: undefined},
      self: {value: undefined}
    };
    var hashCounter = 0;
    function getOwnHashObject(object) {
      var hashObject = object[hashProperty];
      if (hashObject && hashObject.self === object)
        return hashObject;
      if ($isExtensible(object)) {
        hashObjectProperties.hash.value = hashCounter++;
        hashObjectProperties.self.value = object;
        hashPropertyDescriptor.value = $create(null, hashObjectProperties);
        $defineProperty(object, hashProperty, hashPropertyDescriptor);
        return hashPropertyDescriptor.value;
      }
      return undefined;
    }
    function freeze(object) {
      getOwnHashObject(object);
      return $freeze.apply(this, arguments);
    }
    function preventExtensions(object) {
      getOwnHashObject(object);
      return $preventExtensions.apply(this, arguments);
    }
    function seal(object) {
      getOwnHashObject(object);
      return $seal.apply(this, arguments);
    }
    freeze(SymbolValue.prototype);
    function isSymbolString(s) {
      return symbolValues[s] || privateNames[s];
    }
    function toProperty(name) {
      if (isShimSymbol(name))
        return name[symbolInternalProperty];
      return name;
    }
    function removeSymbolKeys(array) {
      var rv = [];
      for (var i = 0; i < array.length; i++) {
        if (!isSymbolString(array[i])) {
          rv.push(array[i]);
        }
      }
      return rv;
    }
    function getOwnPropertyNames(object) {
      return removeSymbolKeys($getOwnPropertyNames(object));
    }
    function keys(object) {
      return removeSymbolKeys($keys(object));
    }
    function getOwnPropertySymbols(object) {
      var rv = [];
      var names = $getOwnPropertyNames(object);
      for (var i = 0; i < names.length; i++) {
        var symbol = symbolValues[names[i]];
        if (symbol) {
          rv.push(symbol);
        }
      }
      return rv;
    }
    function getOwnPropertyDescriptor(object, name) {
      return $getOwnPropertyDescriptor(object, toProperty(name));
    }
    function hasOwnProperty(name) {
      return $hasOwnProperty.call(this, toProperty(name));
    }
    function getOption(name) {
      return global.$traceurRuntime.options[name];
    }
    function defineProperty(object, name, descriptor) {
      if (isShimSymbol(name)) {
        name = name[symbolInternalProperty];
      }
      $defineProperty(object, name, descriptor);
      return object;
    }
    function polyfillObject(Object) {
      $defineProperty(Object, 'defineProperty', {value: defineProperty});
      $defineProperty(Object, 'getOwnPropertyNames', {value: getOwnPropertyNames});
      $defineProperty(Object, 'getOwnPropertyDescriptor', {value: getOwnPropertyDescriptor});
      $defineProperty(Object.prototype, 'hasOwnProperty', {value: hasOwnProperty});
      $defineProperty(Object, 'freeze', {value: freeze});
      $defineProperty(Object, 'preventExtensions', {value: preventExtensions});
      $defineProperty(Object, 'seal', {value: seal});
      $defineProperty(Object, 'keys', {value: keys});
    }
    function exportStar(object) {
      for (var i = 1; i < arguments.length; i++) {
        var names = $getOwnPropertyNames(arguments[i]);
        for (var j = 0; j < names.length; j++) {
          var name = names[j];
          if (name === '__esModule' || isSymbolString(name))
            continue;
          (function(mod, name) {
            $defineProperty(object, name, {
              get: function() {
                return mod[name];
              },
              enumerable: true
            });
          })(arguments[i], names[j]);
        }
      }
      return object;
    }
    function isObject(x) {
      return x != null && (typeof x === 'object' || typeof x === 'function');
    }
    function toObject(x) {
      if (x == null)
        throw $TypeError();
      return $Object(x);
    }
    function checkObjectCoercible(argument) {
      if (argument == null) {
        throw new TypeError('Value cannot be converted to an Object');
      }
      return argument;
    }
    function polyfillSymbol(global, Symbol) {
      if (!global.Symbol) {
        global.Symbol = Symbol;
        Object.getOwnPropertySymbols = getOwnPropertySymbols;
      }
      if (!global.Symbol.iterator) {
        global.Symbol.iterator = Symbol('Symbol.iterator');
      }
      if (!global.Symbol.observer) {
        global.Symbol.observer = Symbol('Symbol.observer');
      }
    }
    function setupGlobals(global) {
      polyfillSymbol(global, Symbol);
      global.Reflect = global.Reflect || {};
      global.Reflect.global = global.Reflect.global || global;
      polyfillObject(global.Object);
    }
    setupGlobals(global);
    global.$traceurRuntime = {
      call: tailCall,
      checkObjectCoercible: checkObjectCoercible,
      construct: construct,
      continuation: createContinuation,
      createPrivateName: createPrivateName,
      defineProperties: $defineProperties,
      defineProperty: $defineProperty,
      exportStar: exportStar,
      getOwnHashObject: getOwnHashObject,
      getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
      getOwnPropertyNames: $getOwnPropertyNames,
      initTailRecursiveFunction: initTailRecursiveFunction,
      isObject: isObject,
      isPrivateName: isPrivateName,
      isSymbolString: isSymbolString,
      keys: $keys,
      options: {},
      setupGlobals: setupGlobals,
      toObject: toObject,
      toProperty: toProperty,
      typeof: typeOf
    };
  })();
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this);
(function() {
  function buildFromEncodedParts(opt_scheme, opt_userInfo, opt_domain, opt_port, opt_path, opt_queryData, opt_fragment) {
    var out = [];
    if (opt_scheme) {
      out.push(opt_scheme, ':');
    }
    if (opt_domain) {
      out.push('//');
      if (opt_userInfo) {
        out.push(opt_userInfo, '@');
      }
      out.push(opt_domain);
      if (opt_port) {
        out.push(':', opt_port);
      }
    }
    if (opt_path) {
      out.push(opt_path);
    }
    if (opt_queryData) {
      out.push('?', opt_queryData);
    }
    if (opt_fragment) {
      out.push('#', opt_fragment);
    }
    return out.join('');
  }
  ;
  var splitRe = new RegExp('^' + '(?:' + '([^:/?#.]+)' + ':)?' + '(?://' + '(?:([^/?#]*)@)?' + '([\\w\\d\\-\\u0100-\\uffff.%]*)' + '(?::([0-9]+))?' + ')?' + '([^?#]+)?' + '(?:\\?([^#]*))?' + '(?:#(.*))?' + '$');
  var ComponentIndex = {
    SCHEME: 1,
    USER_INFO: 2,
    DOMAIN: 3,
    PORT: 4,
    PATH: 5,
    QUERY_DATA: 6,
    FRAGMENT: 7
  };
  function split(uri) {
    return (uri.match(splitRe));
  }
  function removeDotSegments(path) {
    if (path === '/')
      return '/';
    var leadingSlash = path[0] === '/' ? '/' : '';
    var trailingSlash = path.slice(-1) === '/' ? '/' : '';
    var segments = path.split('/');
    var out = [];
    var up = 0;
    for (var pos = 0; pos < segments.length; pos++) {
      var segment = segments[pos];
      switch (segment) {
        case '':
        case '.':
          break;
        case '..':
          if (out.length)
            out.pop();
          else
            up++;
          break;
        default:
          out.push(segment);
      }
    }
    if (!leadingSlash) {
      while (up-- > 0) {
        out.unshift('..');
      }
      if (out.length === 0)
        out.push('.');
    }
    return leadingSlash + out.join('/') + trailingSlash;
  }
  function joinAndCanonicalizePath(parts) {
    var path = parts[ComponentIndex.PATH] || '';
    path = removeDotSegments(path);
    parts[ComponentIndex.PATH] = path;
    return buildFromEncodedParts(parts[ComponentIndex.SCHEME], parts[ComponentIndex.USER_INFO], parts[ComponentIndex.DOMAIN], parts[ComponentIndex.PORT], parts[ComponentIndex.PATH], parts[ComponentIndex.QUERY_DATA], parts[ComponentIndex.FRAGMENT]);
  }
  function canonicalizeUrl(url) {
    var parts = split(url);
    return joinAndCanonicalizePath(parts);
  }
  function resolveUrl(base, url) {
    var parts = split(url);
    var baseParts = split(base);
    if (parts[ComponentIndex.SCHEME]) {
      return joinAndCanonicalizePath(parts);
    } else {
      parts[ComponentIndex.SCHEME] = baseParts[ComponentIndex.SCHEME];
    }
    for (var i = ComponentIndex.SCHEME; i <= ComponentIndex.PORT; i++) {
      if (!parts[i]) {
        parts[i] = baseParts[i];
      }
    }
    if (parts[ComponentIndex.PATH][0] == '/') {
      return joinAndCanonicalizePath(parts);
    }
    var path = baseParts[ComponentIndex.PATH];
    var index = path.lastIndexOf('/');
    path = path.slice(0, index + 1) + parts[ComponentIndex.PATH];
    parts[ComponentIndex.PATH] = path;
    return joinAndCanonicalizePath(parts);
  }
  function isAbsolute(name) {
    if (!name)
      return false;
    if (name[0] === '/')
      return true;
    var parts = split(name);
    if (parts[ComponentIndex.SCHEME])
      return true;
    return false;
  }
  $traceurRuntime.canonicalizeUrl = canonicalizeUrl;
  $traceurRuntime.isAbsolute = isAbsolute;
  $traceurRuntime.removeDotSegments = removeDotSegments;
  $traceurRuntime.resolveUrl = resolveUrl;
})();
(function(global) {
  'use strict';
  var $__1 = $traceurRuntime,
      canonicalizeUrl = $__1.canonicalizeUrl,
      resolveUrl = $__1.resolveUrl,
      isAbsolute = $__1.isAbsolute;
  var moduleInstantiators = Object.create(null);
  var baseURL;
  if (global.location && global.location.href)
    baseURL = resolveUrl(global.location.href, './');
  else
    baseURL = '';
  function UncoatedModuleEntry(url, uncoatedModule) {
    this.url = url;
    this.value_ = uncoatedModule;
  }
  function ModuleEvaluationError(erroneousModuleName, cause) {
    this.message = this.constructor.name + ': ' + this.stripCause(cause) + ' in ' + erroneousModuleName;
    if (!(cause instanceof ModuleEvaluationError) && cause.stack)
      this.stack = this.stripStack(cause.stack);
    else
      this.stack = '';
  }
  ModuleEvaluationError.prototype = Object.create(Error.prototype);
  ModuleEvaluationError.prototype.constructor = ModuleEvaluationError;
  ModuleEvaluationError.prototype.stripError = function(message) {
    return message.replace(/.*Error:/, this.constructor.name + ':');
  };
  ModuleEvaluationError.prototype.stripCause = function(cause) {
    if (!cause)
      return '';
    if (!cause.message)
      return cause + '';
    return this.stripError(cause.message);
  };
  ModuleEvaluationError.prototype.loadedBy = function(moduleName) {
    this.stack += '\n loaded by ' + moduleName;
  };
  ModuleEvaluationError.prototype.stripStack = function(causeStack) {
    var stack = [];
    causeStack.split('\n').some((function(frame) {
      if (/UncoatedModuleInstantiator/.test(frame))
        return true;
      stack.push(frame);
    }));
    stack[0] = this.stripError(stack[0]);
    return stack.join('\n');
  };
  function beforeLines(lines, number) {
    var result = [];
    var first = number - 3;
    if (first < 0)
      first = 0;
    for (var i = first; i < number; i++) {
      result.push(lines[i]);
    }
    return result;
  }
  function afterLines(lines, number) {
    var last = number + 1;
    if (last > lines.length - 1)
      last = lines.length - 1;
    var result = [];
    for (var i = number; i <= last; i++) {
      result.push(lines[i]);
    }
    return result;
  }
  function columnSpacing(columns) {
    var result = '';
    for (var i = 0; i < columns - 1; i++) {
      result += '-';
    }
    return result;
  }
  function UncoatedModuleInstantiator(url, func) {
    UncoatedModuleEntry.call(this, url, null);
    this.func = func;
  }
  UncoatedModuleInstantiator.prototype = Object.create(UncoatedModuleEntry.prototype);
  UncoatedModuleInstantiator.prototype.getUncoatedModule = function() {
    var $__0 = this;
    if (this.value_)
      return this.value_;
    try {
      var relativeRequire;
      if (typeof $traceurRuntime !== undefined && $traceurRuntime.require) {
        relativeRequire = $traceurRuntime.require.bind(null, this.url);
      }
      return this.value_ = this.func.call(global, relativeRequire);
    } catch (ex) {
      if (ex instanceof ModuleEvaluationError) {
        ex.loadedBy(this.url);
        throw ex;
      }
      if (ex.stack) {
        var lines = this.func.toString().split('\n');
        var evaled = [];
        ex.stack.split('\n').some((function(frame, index) {
          if (frame.indexOf('UncoatedModuleInstantiator.getUncoatedModule') > 0)
            return true;
          var m = /(at\s[^\s]*\s).*>:(\d*):(\d*)\)/.exec(frame);
          if (m) {
            var line = parseInt(m[2], 10);
            evaled = evaled.concat(beforeLines(lines, line));
            if (index === 1) {
              evaled.push(columnSpacing(m[3]) + '^ ' + $__0.url);
            } else {
              evaled.push(columnSpacing(m[3]) + '^');
            }
            evaled = evaled.concat(afterLines(lines, line));
            evaled.push('= = = = = = = = =');
          } else {
            evaled.push(frame);
          }
        }));
        ex.stack = evaled.join('\n');
      }
      throw new ModuleEvaluationError(this.url, ex);
    }
  };
  function getUncoatedModuleInstantiator(name) {
    if (!name)
      return ;
    var url = ModuleStore.normalize(name);
    return moduleInstantiators[url];
  }
  ;
  var moduleInstances = Object.create(null);
  var liveModuleSentinel = {};
  function Module(uncoatedModule) {
    var isLive = arguments[1];
    var coatedModule = Object.create(null);
    Object.getOwnPropertyNames(uncoatedModule).forEach((function(name) {
      var getter,
          value;
      if (isLive === liveModuleSentinel) {
        var descr = Object.getOwnPropertyDescriptor(uncoatedModule, name);
        if (descr.get)
          getter = descr.get;
      }
      if (!getter) {
        value = uncoatedModule[name];
        getter = function() {
          return value;
        };
      }
      Object.defineProperty(coatedModule, name, {
        get: getter,
        enumerable: true
      });
    }));
    Object.preventExtensions(coatedModule);
    return coatedModule;
  }
  var ModuleStore = {
    normalize: function(name, refererName, refererAddress) {
      if (typeof name !== 'string')
        throw new TypeError('module name must be a string, not ' + typeof name);
      if (isAbsolute(name))
        return canonicalizeUrl(name);
      if (/[^\.]\/\.\.\//.test(name)) {
        throw new Error('module name embeds /../: ' + name);
      }
      if (name[0] === '.' && refererName)
        return resolveUrl(refererName, name);
      return canonicalizeUrl(name);
    },
    get: function(normalizedName) {
      var m = getUncoatedModuleInstantiator(normalizedName);
      if (!m)
        return undefined;
      var moduleInstance = moduleInstances[m.url];
      if (moduleInstance)
        return moduleInstance;
      moduleInstance = Module(m.getUncoatedModule(), liveModuleSentinel);
      return moduleInstances[m.url] = moduleInstance;
    },
    set: function(normalizedName, module) {
      normalizedName = String(normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, (function() {
        return module;
      }));
      moduleInstances[normalizedName] = module;
    },
    get baseURL() {
      return baseURL;
    },
    set baseURL(v) {
      baseURL = String(v);
    },
    registerModule: function(name, deps, func) {
      var normalizedName = ModuleStore.normalize(name);
      if (moduleInstantiators[normalizedName])
        throw new Error('duplicate module named ' + normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, func);
    },
    bundleStore: Object.create(null),
    register: function(name, deps, func) {
      if (!deps || !deps.length && !func.length) {
        this.registerModule(name, deps, func);
      } else {
        this.bundleStore[name] = {
          deps: deps,
          execute: function() {
            var $__0 = arguments;
            var depMap = {};
            deps.forEach((function(dep, index) {
              return depMap[dep] = $__0[index];
            }));
            var registryEntry = func.call(this, depMap);
            registryEntry.execute.call(this);
            return registryEntry.exports;
          }
        };
      }
    },
    getAnonymousModule: function(func) {
      return new Module(func.call(global), liveModuleSentinel);
    },
    getForTesting: function(name) {
      var $__0 = this;
      if (!this.testingPrefix_) {
        Object.keys(moduleInstances).some((function(key) {
          var m = /(traceur@[^\/]*\/)/.exec(key);
          if (m) {
            $__0.testingPrefix_ = m[1];
            return true;
          }
        }));
      }
      return this.get(this.testingPrefix_ + name);
    }
  };
  var moduleStoreModule = new Module({ModuleStore: ModuleStore});
  ModuleStore.set('@traceur/src/runtime/ModuleStore.js', moduleStoreModule);
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
  };
  $traceurRuntime.ModuleStore = ModuleStore;
  global.System = {
    register: ModuleStore.register.bind(ModuleStore),
    registerModule: ModuleStore.registerModule.bind(ModuleStore),
    get: ModuleStore.get,
    set: ModuleStore.set,
    normalize: ModuleStore.normalize
  };
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this);
System.registerModule("traceur-runtime@0.0.88/src/runtime/async.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/async.js";
  if (typeof $traceurRuntime !== 'object') {
    throw new Error('traceur runtime not found.');
  }
  var $createPrivateName = $traceurRuntime.createPrivateName;
  var $defineProperty = $traceurRuntime.defineProperty;
  var $defineProperties = $traceurRuntime.defineProperties;
  var $create = Object.create;
  var thisName = $createPrivateName();
  var argsName = $createPrivateName();
  var observeName = $createPrivateName();
  function AsyncGeneratorFunction() {}
  function AsyncGeneratorFunctionPrototype() {}
  AsyncGeneratorFunction.prototype = AsyncGeneratorFunctionPrototype;
  AsyncGeneratorFunctionPrototype.constructor = AsyncGeneratorFunction;
  $defineProperty(AsyncGeneratorFunctionPrototype, 'constructor', {enumerable: false});
  var AsyncGeneratorContext = (function() {
    function AsyncGeneratorContext(observer) {
      var $__0 = this;
      this.decoratedObserver = $traceurRuntime.createDecoratedGenerator(observer, (function() {
        $__0.done = true;
      }));
      this.done = false;
      this.inReturn = false;
    }
    return ($traceurRuntime.createClass)(AsyncGeneratorContext, {
      throw: function(error) {
        if (!this.inReturn) {
          throw error;
        }
      },
      yield: function(value) {
        if (this.done) {
          this.inReturn = true;
          throw undefined;
        }
        var result;
        try {
          result = this.decoratedObserver.next(value);
        } catch (e) {
          this.done = true;
          throw e;
        }
        if (result === undefined) {
          return ;
        }
        if (result.done) {
          this.done = true;
          this.inReturn = true;
          throw undefined;
        }
        return result.value;
      },
      yieldFor: function(observable) {
        var ctx = this;
        return $traceurRuntime.observeForEach(observable[$traceurRuntime.toProperty(Symbol.observer)].bind(observable), function(value) {
          if (ctx.done) {
            this.return();
            return ;
          }
          var result;
          try {
            result = ctx.decoratedObserver.next(value);
          } catch (e) {
            ctx.done = true;
            throw e;
          }
          if (result === undefined) {
            return ;
          }
          if (result.done) {
            ctx.done = true;
          }
          return result;
        });
      }
    }, {});
  }());
  AsyncGeneratorFunctionPrototype.prototype[Symbol.observer] = function(observer) {
    var observe = this[observeName];
    var ctx = new AsyncGeneratorContext(observer);
    $traceurRuntime.schedule((function() {
      return observe(ctx);
    })).then((function(value) {
      if (!ctx.done) {
        ctx.decoratedObserver.return(value);
      }
    })).catch((function(error) {
      if (!ctx.done) {
        ctx.decoratedObserver.throw(error);
      }
    }));
    return ctx.decoratedObserver;
  };
  $defineProperty(AsyncGeneratorFunctionPrototype.prototype, Symbol.observer, {enumerable: false});
  function initAsyncGeneratorFunction(functionObject) {
    functionObject.prototype = $create(AsyncGeneratorFunctionPrototype.prototype);
    functionObject.__proto__ = AsyncGeneratorFunctionPrototype;
    return functionObject;
  }
  function createAsyncGeneratorInstance(observe, functionObject) {
    for (var args = [],
        $__2 = 2; $__2 < arguments.length; $__2++)
      args[$__2 - 2] = arguments[$__2];
    var object = $create(functionObject.prototype);
    object[thisName] = this;
    object[argsName] = args;
    object[observeName] = observe;
    return object;
  }
  function observeForEach(observe, next) {
    return new Promise((function(resolve, reject) {
      var generator = observe({
        next: function(value) {
          return next.call(generator, value);
        },
        throw: function(error) {
          reject(error);
        },
        return: function(value) {
          resolve(value);
        }
      });
    }));
  }
  function schedule(asyncF) {
    return Promise.resolve().then(asyncF);
  }
  var generator = Symbol();
  var onDone = Symbol();
  var DecoratedGenerator = (function() {
    function DecoratedGenerator(_generator, _onDone) {
      this[generator] = _generator;
      this[onDone] = _onDone;
    }
    return ($traceurRuntime.createClass)(DecoratedGenerator, {
      next: function(value) {
        var result = this[generator].next(value);
        if (result !== undefined && result.done) {
          this[onDone].call(this);
        }
        return result;
      },
      throw: function(error) {
        this[onDone].call(this);
        return this[generator].throw(error);
      },
      return: function(value) {
        this[onDone].call(this);
        return this[generator].return(value);
      }
    }, {});
  }());
  function createDecoratedGenerator(generator, onDone) {
    return new DecoratedGenerator(generator, onDone);
  }
  $traceurRuntime.initAsyncGeneratorFunction = initAsyncGeneratorFunction;
  $traceurRuntime.createAsyncGeneratorInstance = createAsyncGeneratorInstance;
  $traceurRuntime.observeForEach = observeForEach;
  $traceurRuntime.schedule = schedule;
  $traceurRuntime.createDecoratedGenerator = createDecoratedGenerator;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/classes.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/classes.js";
  var $Object = Object;
  var $TypeError = TypeError;
  var $create = $Object.create;
  var $defineProperties = $traceurRuntime.defineProperties;
  var $defineProperty = $traceurRuntime.defineProperty;
  var $getOwnPropertyDescriptor = $traceurRuntime.getOwnPropertyDescriptor;
  var $getOwnPropertyNames = $traceurRuntime.getOwnPropertyNames;
  var $getPrototypeOf = Object.getPrototypeOf;
  var $__0 = Object,
      getOwnPropertyNames = $__0.getOwnPropertyNames,
      getOwnPropertySymbols = $__0.getOwnPropertySymbols;
  function superDescriptor(homeObject, name) {
    var proto = $getPrototypeOf(homeObject);
    do {
      var result = $getOwnPropertyDescriptor(proto, name);
      if (result)
        return result;
      proto = $getPrototypeOf(proto);
    } while (proto);
    return undefined;
  }
  function superConstructor(ctor) {
    return ctor.__proto__;
  }
  function superGet(self, homeObject, name) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor) {
      if (!descriptor.get)
        return descriptor.value;
      return descriptor.get.call(self);
    }
    return undefined;
  }
  function superSet(self, homeObject, name, value) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor && descriptor.set) {
      descriptor.set.call(self, value);
      return value;
    }
    throw $TypeError(("super has no setter '" + name + "'."));
  }
  function forEachPropertyKey(object, f) {
    getOwnPropertyNames(object).forEach(f);
    getOwnPropertySymbols(object).forEach(f);
  }
  function getDescriptors(object) {
    var descriptors = {};
    forEachPropertyKey(object, (function(key) {
      descriptors[key] = $getOwnPropertyDescriptor(object, key);
      descriptors[key].enumerable = false;
    }));
    return descriptors;
  }
  var nonEnum = {enumerable: false};
  function makePropertiesNonEnumerable(object) {
    forEachPropertyKey(object, (function(key) {
      $defineProperty(object, key, nonEnum);
    }));
  }
  function createClass(ctor, object, staticObject, superClass) {
    $defineProperty(object, 'constructor', {
      value: ctor,
      configurable: true,
      enumerable: false,
      writable: true
    });
    if (arguments.length > 3) {
      if (typeof superClass === 'function')
        ctor.__proto__ = superClass;
      ctor.prototype = $create(getProtoParent(superClass), getDescriptors(object));
    } else {
      makePropertiesNonEnumerable(object);
      ctor.prototype = object;
    }
    $defineProperty(ctor, 'prototype', {
      configurable: false,
      writable: false
    });
    return $defineProperties(ctor, getDescriptors(staticObject));
  }
  function getProtoParent(superClass) {
    if (typeof superClass === 'function') {
      var prototype = superClass.prototype;
      if ($Object(prototype) === prototype || prototype === null)
        return superClass.prototype;
      throw new $TypeError('super prototype must be an Object or null');
    }
    if (superClass === null)
      return null;
    throw new $TypeError(("Super expression must either be null or a function, not " + typeof superClass + "."));
  }
  $traceurRuntime.createClass = createClass;
  $traceurRuntime.superConstructor = superConstructor;
  $traceurRuntime.superGet = superGet;
  $traceurRuntime.superSet = superSet;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/destructuring.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/destructuring.js";
  function iteratorToArray(iter) {
    var rv = [];
    var i = 0;
    var tmp;
    while (!(tmp = iter.next()).done) {
      rv[i++] = tmp.value;
    }
    return rv;
  }
  $traceurRuntime.iteratorToArray = iteratorToArray;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/generators.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/generators.js";
  if (typeof $traceurRuntime !== 'object') {
    throw new Error('traceur runtime not found.');
  }
  var createPrivateName = $traceurRuntime.createPrivateName;
  var $defineProperties = $traceurRuntime.defineProperties;
  var $defineProperty = $traceurRuntime.defineProperty;
  var $create = Object.create;
  var $TypeError = TypeError;
  function nonEnum(value) {
    return {
      configurable: true,
      enumerable: false,
      value: value,
      writable: true
    };
  }
  var ST_NEWBORN = 0;
  var ST_EXECUTING = 1;
  var ST_SUSPENDED = 2;
  var ST_CLOSED = 3;
  var END_STATE = -2;
  var RETHROW_STATE = -3;
  function getInternalError(state) {
    return new Error('Traceur compiler bug: invalid state in state machine: ' + state);
  }
  var RETURN_SENTINEL = {};
  function GeneratorContext() {
    this.state = 0;
    this.GState = ST_NEWBORN;
    this.storedException = undefined;
    this.finallyFallThrough = undefined;
    this.sent_ = undefined;
    this.returnValue = undefined;
    this.oldReturnValue = undefined;
    this.tryStack_ = [];
  }
  GeneratorContext.prototype = {
    pushTry: function(catchState, finallyState) {
      if (finallyState !== null) {
        var finallyFallThrough = null;
        for (var i = this.tryStack_.length - 1; i >= 0; i--) {
          if (this.tryStack_[i].catch !== undefined) {
            finallyFallThrough = this.tryStack_[i].catch;
            break;
          }
        }
        if (finallyFallThrough === null)
          finallyFallThrough = RETHROW_STATE;
        this.tryStack_.push({
          finally: finallyState,
          finallyFallThrough: finallyFallThrough
        });
      }
      if (catchState !== null) {
        this.tryStack_.push({catch: catchState});
      }
    },
    popTry: function() {
      this.tryStack_.pop();
    },
    maybeUncatchable: function() {
      if (this.storedException === RETURN_SENTINEL) {
        throw RETURN_SENTINEL;
      }
    },
    get sent() {
      this.maybeThrow();
      return this.sent_;
    },
    set sent(v) {
      this.sent_ = v;
    },
    get sentIgnoreThrow() {
      return this.sent_;
    },
    maybeThrow: function() {
      if (this.action === 'throw') {
        this.action = 'next';
        throw this.sent_;
      }
    },
    end: function() {
      switch (this.state) {
        case END_STATE:
          return this;
        case RETHROW_STATE:
          throw this.storedException;
        default:
          throw getInternalError(this.state);
      }
    },
    handleException: function(ex) {
      this.GState = ST_CLOSED;
      this.state = END_STATE;
      throw ex;
    },
    wrapYieldStar: function(iterator) {
      var ctx = this;
      return {
        next: function(v) {
          return iterator.next(v);
        },
        throw: function(e) {
          var result;
          if (e === RETURN_SENTINEL) {
            if (iterator.return) {
              result = iterator.return(ctx.returnValue);
              if (!result.done) {
                ctx.returnValue = ctx.oldReturnValue;
                return result;
              }
              ctx.returnValue = result.value;
            }
            throw e;
          }
          if (iterator.throw) {
            return iterator.throw(e);
          }
          iterator.return && iterator.return();
          throw $TypeError('Inner iterator does not have a throw method');
        }
      };
    }
  };
  function nextOrThrow(ctx, moveNext, action, x) {
    switch (ctx.GState) {
      case ST_EXECUTING:
        throw new Error(("\"" + action + "\" on executing generator"));
      case ST_CLOSED:
        if (action == 'next') {
          return {
            value: undefined,
            done: true
          };
        }
        if (x === RETURN_SENTINEL) {
          return {
            value: ctx.returnValue,
            done: true
          };
        }
        throw x;
      case ST_NEWBORN:
        if (action === 'throw') {
          ctx.GState = ST_CLOSED;
          if (x === RETURN_SENTINEL) {
            return {
              value: ctx.returnValue,
              done: true
            };
          }
          throw x;
        }
        if (x !== undefined)
          throw $TypeError('Sent value to newborn generator');
      case ST_SUSPENDED:
        ctx.GState = ST_EXECUTING;
        ctx.action = action;
        ctx.sent = x;
        var value;
        try {
          value = moveNext(ctx);
        } catch (ex) {
          if (ex === RETURN_SENTINEL) {
            value = ctx;
          } else {
            throw ex;
          }
        }
        var done = value === ctx;
        if (done)
          value = ctx.returnValue;
        ctx.GState = done ? ST_CLOSED : ST_SUSPENDED;
        return {
          value: value,
          done: done
        };
    }
  }
  var ctxName = createPrivateName();
  var moveNextName = createPrivateName();
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  $defineProperty(GeneratorFunctionPrototype, 'constructor', nonEnum(GeneratorFunction));
  GeneratorFunctionPrototype.prototype = {
    constructor: GeneratorFunctionPrototype,
    next: function(v) {
      return nextOrThrow(this[ctxName], this[moveNextName], 'next', v);
    },
    throw: function(v) {
      return nextOrThrow(this[ctxName], this[moveNextName], 'throw', v);
    },
    return: function(v) {
      this[ctxName].oldReturnValue = this[ctxName].returnValue;
      this[ctxName].returnValue = v;
      return nextOrThrow(this[ctxName], this[moveNextName], 'throw', RETURN_SENTINEL);
    }
  };
  $defineProperties(GeneratorFunctionPrototype.prototype, {
    constructor: {enumerable: false},
    next: {enumerable: false},
    throw: {enumerable: false},
    return: {enumerable: false}
  });
  Object.defineProperty(GeneratorFunctionPrototype.prototype, Symbol.iterator, nonEnum(function() {
    return this;
  }));
  function createGeneratorInstance(innerFunction, functionObject, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new GeneratorContext();
    var object = $create(functionObject.prototype);
    object[ctxName] = ctx;
    object[moveNextName] = moveNext;
    return object;
  }
  function initGeneratorFunction(functionObject) {
    functionObject.prototype = $create(GeneratorFunctionPrototype.prototype);
    functionObject.__proto__ = GeneratorFunctionPrototype;
    return functionObject;
  }
  function AsyncFunctionContext() {
    GeneratorContext.call(this);
    this.err = undefined;
    var ctx = this;
    ctx.result = new Promise(function(resolve, reject) {
      ctx.resolve = resolve;
      ctx.reject = reject;
    });
  }
  AsyncFunctionContext.prototype = $create(GeneratorContext.prototype);
  AsyncFunctionContext.prototype.end = function() {
    switch (this.state) {
      case END_STATE:
        this.resolve(this.returnValue);
        break;
      case RETHROW_STATE:
        this.reject(this.storedException);
        break;
      default:
        this.reject(getInternalError(this.state));
    }
  };
  AsyncFunctionContext.prototype.handleException = function() {
    this.state = RETHROW_STATE;
  };
  function asyncWrap(innerFunction, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new AsyncFunctionContext();
    ctx.createCallback = function(newState) {
      return function(value) {
        ctx.state = newState;
        ctx.value = value;
        moveNext(ctx);
      };
    };
    ctx.errback = function(err) {
      handleCatch(ctx, err);
      moveNext(ctx);
    };
    moveNext(ctx);
    return ctx.result;
  }
  function getMoveNext(innerFunction, self) {
    return function(ctx) {
      while (true) {
        try {
          return innerFunction.call(self, ctx);
        } catch (ex) {
          handleCatch(ctx, ex);
        }
      }
    };
  }
  function handleCatch(ctx, ex) {
    ctx.storedException = ex;
    var last = ctx.tryStack_[ctx.tryStack_.length - 1];
    if (!last) {
      ctx.handleException(ex);
      return ;
    }
    ctx.state = last.catch !== undefined ? last.catch : last.finally;
    if (last.finallyFallThrough !== undefined)
      ctx.finallyFallThrough = last.finallyFallThrough;
  }
  $traceurRuntime.asyncWrap = asyncWrap;
  $traceurRuntime.initGeneratorFunction = initGeneratorFunction;
  $traceurRuntime.createGeneratorInstance = createGeneratorInstance;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/relativeRequire.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/relativeRequire.js";
  var path;
  function relativeRequire(callerPath, requiredPath) {
    path = path || typeof require !== 'undefined' && require('path');
    function isDirectory(path) {
      return path.slice(-1) === '/';
    }
    function isAbsolute(path) {
      return path[0] === '/';
    }
    function isRelative(path) {
      return path[0] === '.';
    }
    if (isDirectory(requiredPath) || isAbsolute(requiredPath))
      return ;
    return isRelative(requiredPath) ? require(path.resolve(path.dirname(callerPath), requiredPath)) : require(requiredPath);
  }
  $traceurRuntime.require = relativeRequire;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/spread.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/spread.js";
  function spread() {
    var rv = [],
        j = 0,
        iterResult;
    for (var i = 0; i < arguments.length; i++) {
      var valueToSpread = $traceurRuntime.checkObjectCoercible(arguments[i]);
      if (typeof valueToSpread[$traceurRuntime.toProperty(Symbol.iterator)] !== 'function') {
        throw new TypeError('Cannot spread non-iterable object.');
      }
      var iter = valueToSpread[$traceurRuntime.toProperty(Symbol.iterator)]();
      while (!(iterResult = iter.next()).done) {
        rv[j++] = iterResult.value;
      }
    }
    return rv;
  }
  $traceurRuntime.spread = spread;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/template.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/template.js";
  var $__0 = Object,
      defineProperty = $__0.defineProperty,
      freeze = $__0.freeze;
  var slice = Array.prototype.slice;
  var map = Object.create(null);
  function getTemplateObject(raw) {
    var cooked = arguments[1];
    var key = raw.join('${}');
    var templateObject = map[key];
    if (templateObject)
      return templateObject;
    if (!cooked) {
      cooked = slice.call(raw);
    }
    return map[key] = freeze(defineProperty(cooked, 'raw', {value: freeze(raw)}));
  }
  $traceurRuntime.getTemplateObject = getTemplateObject;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/type-assertions.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/type-assertions.js";
  var types = {
    any: {name: 'any'},
    boolean: {name: 'boolean'},
    number: {name: 'number'},
    string: {name: 'string'},
    symbol: {name: 'symbol'},
    void: {name: 'void'}
  };
  var GenericType = (function() {
    function GenericType(type, argumentTypes) {
      this.type = type;
      this.argumentTypes = argumentTypes;
    }
    return ($traceurRuntime.createClass)(GenericType, {}, {});
  }());
  var typeRegister = Object.create(null);
  function genericType(type) {
    for (var argumentTypes = [],
        $__1 = 1; $__1 < arguments.length; $__1++)
      argumentTypes[$__1 - 1] = arguments[$__1];
    var typeMap = typeRegister;
    var key = $traceurRuntime.getOwnHashObject(type).hash;
    if (!typeMap[key]) {
      typeMap[key] = Object.create(null);
    }
    typeMap = typeMap[key];
    for (var i = 0; i < argumentTypes.length - 1; i++) {
      key = $traceurRuntime.getOwnHashObject(argumentTypes[i]).hash;
      if (!typeMap[key]) {
        typeMap[key] = Object.create(null);
      }
      typeMap = typeMap[key];
    }
    var tail = argumentTypes[argumentTypes.length - 1];
    key = $traceurRuntime.getOwnHashObject(tail).hash;
    if (!typeMap[key]) {
      typeMap[key] = new GenericType(type, argumentTypes);
    }
    return typeMap[key];
  }
  $traceurRuntime.GenericType = GenericType;
  $traceurRuntime.genericType = genericType;
  $traceurRuntime.type = types;
  return {};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/runtime-modules.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/runtime-modules.js";
  System.get("traceur-runtime@0.0.88/src/runtime/relativeRequire.js");
  System.get("traceur-runtime@0.0.88/src/runtime/spread.js");
  System.get("traceur-runtime@0.0.88/src/runtime/destructuring.js");
  System.get("traceur-runtime@0.0.88/src/runtime/classes.js");
  System.get("traceur-runtime@0.0.88/src/runtime/async.js");
  System.get("traceur-runtime@0.0.88/src/runtime/generators.js");
  System.get("traceur-runtime@0.0.88/src/runtime/template.js");
  System.get("traceur-runtime@0.0.88/src/runtime/type-assertions.js");
  return {};
});
System.get("traceur-runtime@0.0.88/src/runtime/runtime-modules.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/utils.js";
  var $ceil = Math.ceil;
  var $floor = Math.floor;
  var $isFinite = isFinite;
  var $isNaN = isNaN;
  var $pow = Math.pow;
  var $min = Math.min;
  var toObject = $traceurRuntime.toObject;
  function toUint32(x) {
    return x >>> 0;
  }
  function isObject(x) {
    return x && (typeof x === 'object' || typeof x === 'function');
  }
  function isCallable(x) {
    return typeof x === 'function';
  }
  function isNumber(x) {
    return typeof x === 'number';
  }
  function toInteger(x) {
    x = +x;
    if ($isNaN(x))
      return 0;
    if (x === 0 || !$isFinite(x))
      return x;
    return x > 0 ? $floor(x) : $ceil(x);
  }
  var MAX_SAFE_LENGTH = $pow(2, 53) - 1;
  function toLength(x) {
    var len = toInteger(x);
    return len < 0 ? 0 : $min(len, MAX_SAFE_LENGTH);
  }
  function checkIterable(x) {
    return !isObject(x) ? undefined : x[Symbol.iterator];
  }
  function isConstructor(x) {
    return isCallable(x);
  }
  function createIteratorResultObject(value, done) {
    return {
      value: value,
      done: done
    };
  }
  function maybeDefine(object, name, descr) {
    if (!(name in object)) {
      Object.defineProperty(object, name, descr);
    }
  }
  function maybeDefineMethod(object, name, value) {
    maybeDefine(object, name, {
      value: value,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  function maybeDefineConst(object, name, value) {
    maybeDefine(object, name, {
      value: value,
      configurable: false,
      enumerable: false,
      writable: false
    });
  }
  function maybeAddFunctions(object, functions) {
    for (var i = 0; i < functions.length; i += 2) {
      var name = functions[i];
      var value = functions[i + 1];
      maybeDefineMethod(object, name, value);
    }
  }
  function maybeAddConsts(object, consts) {
    for (var i = 0; i < consts.length; i += 2) {
      var name = consts[i];
      var value = consts[i + 1];
      maybeDefineConst(object, name, value);
    }
  }
  function maybeAddIterator(object, func, Symbol) {
    if (!Symbol || !Symbol.iterator || object[Symbol.iterator])
      return ;
    if (object['@@iterator'])
      func = object['@@iterator'];
    Object.defineProperty(object, Symbol.iterator, {
      value: func,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  var polyfills = [];
  function registerPolyfill(func) {
    polyfills.push(func);
  }
  function polyfillAll(global) {
    polyfills.forEach((function(f) {
      return f(global);
    }));
  }
  return {
    get toObject() {
      return toObject;
    },
    get toUint32() {
      return toUint32;
    },
    get isObject() {
      return isObject;
    },
    get isCallable() {
      return isCallable;
    },
    get isNumber() {
      return isNumber;
    },
    get toInteger() {
      return toInteger;
    },
    get toLength() {
      return toLength;
    },
    get checkIterable() {
      return checkIterable;
    },
    get isConstructor() {
      return isConstructor;
    },
    get createIteratorResultObject() {
      return createIteratorResultObject;
    },
    get maybeDefine() {
      return maybeDefine;
    },
    get maybeDefineMethod() {
      return maybeDefineMethod;
    },
    get maybeDefineConst() {
      return maybeDefineConst;
    },
    get maybeAddFunctions() {
      return maybeAddFunctions;
    },
    get maybeAddConsts() {
      return maybeAddConsts;
    },
    get maybeAddIterator() {
      return maybeAddIterator;
    },
    get registerPolyfill() {
      return registerPolyfill;
    },
    get polyfillAll() {
      return polyfillAll;
    }
  };
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Map.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Map.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      isObject = $__0.isObject,
      maybeAddIterator = $__0.maybeAddIterator,
      registerPolyfill = $__0.registerPolyfill;
  var getOwnHashObject = $traceurRuntime.getOwnHashObject;
  var $hasOwnProperty = Object.prototype.hasOwnProperty;
  var deletedSentinel = {};
  function lookupIndex(map, key) {
    if (isObject(key)) {
      var hashObject = getOwnHashObject(key);
      return hashObject && map.objectIndex_[hashObject.hash];
    }
    if (typeof key === 'string')
      return map.stringIndex_[key];
    return map.primitiveIndex_[key];
  }
  function initMap(map) {
    map.entries_ = [];
    map.objectIndex_ = Object.create(null);
    map.stringIndex_ = Object.create(null);
    map.primitiveIndex_ = Object.create(null);
    map.deletedCount_ = 0;
  }
  var Map = (function() {
    function Map() {
      var $__10,
          $__11;
      var iterable = arguments[0];
      if (!isObject(this))
        throw new TypeError('Map called on incompatible type');
      if ($hasOwnProperty.call(this, 'entries_')) {
        throw new TypeError('Map can not be reentrantly initialised');
      }
      initMap(this);
      if (iterable !== null && iterable !== undefined) {
        var $__5 = true;
        var $__6 = false;
        var $__7 = undefined;
        try {
          for (var $__3 = void 0,
              $__2 = (iterable)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
            var $__9 = $__3.value,
                key = ($__10 = $__9[$traceurRuntime.toProperty(Symbol.iterator)](), ($__11 = $__10.next()).done ? void 0 : $__11.value),
                value = ($__11 = $__10.next()).done ? void 0 : $__11.value;
            {
              this.set(key, value);
            }
          }
        } catch ($__8) {
          $__6 = true;
          $__7 = $__8;
        } finally {
          try {
            if (!$__5 && $__2.return != null) {
              $__2.return();
            }
          } finally {
            if ($__6) {
              throw $__7;
            }
          }
        }
      }
    }
    return ($traceurRuntime.createClass)(Map, {
      get size() {
        return this.entries_.length / 2 - this.deletedCount_;
      },
      get: function(key) {
        var index = lookupIndex(this, key);
        if (index !== undefined)
          return this.entries_[index + 1];
      },
      set: function(key, value) {
        var objectMode = isObject(key);
        var stringMode = typeof key === 'string';
        var index = lookupIndex(this, key);
        if (index !== undefined) {
          this.entries_[index + 1] = value;
        } else {
          index = this.entries_.length;
          this.entries_[index] = key;
          this.entries_[index + 1] = value;
          if (objectMode) {
            var hashObject = getOwnHashObject(key);
            var hash = hashObject.hash;
            this.objectIndex_[hash] = index;
          } else if (stringMode) {
            this.stringIndex_[key] = index;
          } else {
            this.primitiveIndex_[key] = index;
          }
        }
        return this;
      },
      has: function(key) {
        return lookupIndex(this, key) !== undefined;
      },
      delete: function(key) {
        var objectMode = isObject(key);
        var stringMode = typeof key === 'string';
        var index;
        var hash;
        if (objectMode) {
          var hashObject = getOwnHashObject(key);
          if (hashObject) {
            index = this.objectIndex_[hash = hashObject.hash];
            delete this.objectIndex_[hash];
          }
        } else if (stringMode) {
          index = this.stringIndex_[key];
          delete this.stringIndex_[key];
        } else {
          index = this.primitiveIndex_[key];
          delete this.primitiveIndex_[key];
        }
        if (index !== undefined) {
          this.entries_[index] = deletedSentinel;
          this.entries_[index + 1] = undefined;
          this.deletedCount_++;
          return true;
        }
        return false;
      },
      clear: function() {
        initMap(this);
      },
      forEach: function(callbackFn) {
        var thisArg = arguments[1];
        for (var i = 0; i < this.entries_.length; i += 2) {
          var key = this.entries_[i];
          var value = this.entries_[i + 1];
          if (key === deletedSentinel)
            continue;
          callbackFn.call(thisArg, value, key, this);
        }
      },
      entries: $traceurRuntime.initGeneratorFunction(function $__12() {
        var i,
            key,
            value;
        return $traceurRuntime.createGeneratorInstance(function($ctx) {
          while (true)
            switch ($ctx.state) {
              case 0:
                i = 0;
                $ctx.state = 12;
                break;
              case 12:
                $ctx.state = (i < this.entries_.length) ? 8 : -2;
                break;
              case 4:
                i += 2;
                $ctx.state = 12;
                break;
              case 8:
                key = this.entries_[i];
                value = this.entries_[i + 1];
                $ctx.state = 9;
                break;
              case 9:
                $ctx.state = (key === deletedSentinel) ? 4 : 6;
                break;
              case 6:
                $ctx.state = 2;
                return [key, value];
              case 2:
                $ctx.maybeThrow();
                $ctx.state = 4;
                break;
              default:
                return $ctx.end();
            }
        }, $__12, this);
      }),
      keys: $traceurRuntime.initGeneratorFunction(function $__13() {
        var i,
            key,
            value;
        return $traceurRuntime.createGeneratorInstance(function($ctx) {
          while (true)
            switch ($ctx.state) {
              case 0:
                i = 0;
                $ctx.state = 12;
                break;
              case 12:
                $ctx.state = (i < this.entries_.length) ? 8 : -2;
                break;
              case 4:
                i += 2;
                $ctx.state = 12;
                break;
              case 8:
                key = this.entries_[i];
                value = this.entries_[i + 1];
                $ctx.state = 9;
                break;
              case 9:
                $ctx.state = (key === deletedSentinel) ? 4 : 6;
                break;
              case 6:
                $ctx.state = 2;
                return key;
              case 2:
                $ctx.maybeThrow();
                $ctx.state = 4;
                break;
              default:
                return $ctx.end();
            }
        }, $__13, this);
      }),
      values: $traceurRuntime.initGeneratorFunction(function $__14() {
        var i,
            key,
            value;
        return $traceurRuntime.createGeneratorInstance(function($ctx) {
          while (true)
            switch ($ctx.state) {
              case 0:
                i = 0;
                $ctx.state = 12;
                break;
              case 12:
                $ctx.state = (i < this.entries_.length) ? 8 : -2;
                break;
              case 4:
                i += 2;
                $ctx.state = 12;
                break;
              case 8:
                key = this.entries_[i];
                value = this.entries_[i + 1];
                $ctx.state = 9;
                break;
              case 9:
                $ctx.state = (key === deletedSentinel) ? 4 : 6;
                break;
              case 6:
                $ctx.state = 2;
                return value;
              case 2:
                $ctx.maybeThrow();
                $ctx.state = 4;
                break;
              default:
                return $ctx.end();
            }
        }, $__14, this);
      })
    }, {});
  }());
  Object.defineProperty(Map.prototype, Symbol.iterator, {
    configurable: true,
    writable: true,
    value: Map.prototype.entries
  });
  function polyfillMap(global) {
    var $__9 = global,
        Object = $__9.Object,
        Symbol = $__9.Symbol;
    if (!global.Map)
      global.Map = Map;
    var mapPrototype = global.Map.prototype;
    if (mapPrototype.entries === undefined)
      global.Map = Map;
    if (mapPrototype.entries) {
      maybeAddIterator(mapPrototype, mapPrototype.entries, Symbol);
      maybeAddIterator(Object.getPrototypeOf(new global.Map().entries()), function() {
        return this;
      }, Symbol);
    }
  }
  registerPolyfill(polyfillMap);
  return {
    get Map() {
      return Map;
    },
    get polyfillMap() {
      return polyfillMap;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Map.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Set.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Set.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      isObject = $__0.isObject,
      maybeAddIterator = $__0.maybeAddIterator,
      registerPolyfill = $__0.registerPolyfill;
  var Map = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Map.js").Map;
  var getOwnHashObject = $traceurRuntime.getOwnHashObject;
  var $hasOwnProperty = Object.prototype.hasOwnProperty;
  function initSet(set) {
    set.map_ = new Map();
  }
  var Set = (function() {
    function Set() {
      var iterable = arguments[0];
      if (!isObject(this))
        throw new TypeError('Set called on incompatible type');
      if ($hasOwnProperty.call(this, 'map_')) {
        throw new TypeError('Set can not be reentrantly initialised');
      }
      initSet(this);
      if (iterable !== null && iterable !== undefined) {
        var $__7 = true;
        var $__8 = false;
        var $__9 = undefined;
        try {
          for (var $__5 = void 0,
              $__4 = (iterable)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__7 = ($__5 = $__4.next()).done); $__7 = true) {
            var item = $__5.value;
            {
              this.add(item);
            }
          }
        } catch ($__10) {
          $__8 = true;
          $__9 = $__10;
        } finally {
          try {
            if (!$__7 && $__4.return != null) {
              $__4.return();
            }
          } finally {
            if ($__8) {
              throw $__9;
            }
          }
        }
      }
    }
    return ($traceurRuntime.createClass)(Set, {
      get size() {
        return this.map_.size;
      },
      has: function(key) {
        return this.map_.has(key);
      },
      add: function(key) {
        this.map_.set(key, key);
        return this;
      },
      delete: function(key) {
        return this.map_.delete(key);
      },
      clear: function() {
        return this.map_.clear();
      },
      forEach: function(callbackFn) {
        var thisArg = arguments[1];
        var $__2 = this;
        return this.map_.forEach((function(value, key) {
          callbackFn.call(thisArg, key, key, $__2);
        }));
      },
      values: $traceurRuntime.initGeneratorFunction(function $__12() {
        var $__13,
            $__14;
        return $traceurRuntime.createGeneratorInstance(function($ctx) {
          while (true)
            switch ($ctx.state) {
              case 0:
                $__13 = $ctx.wrapYieldStar(this.map_.keys()[Symbol.iterator]());
                $ctx.sent = void 0;
                $ctx.action = 'next';
                $ctx.state = 12;
                break;
              case 12:
                $__14 = $__13[$ctx.action]($ctx.sentIgnoreThrow);
                $ctx.state = 9;
                break;
              case 9:
                $ctx.state = ($__14.done) ? 3 : 2;
                break;
              case 3:
                $ctx.sent = $__14.value;
                $ctx.state = -2;
                break;
              case 2:
                $ctx.state = 12;
                return $__14.value;
              default:
                return $ctx.end();
            }
        }, $__12, this);
      }),
      entries: $traceurRuntime.initGeneratorFunction(function $__15() {
        var $__16,
            $__17;
        return $traceurRuntime.createGeneratorInstance(function($ctx) {
          while (true)
            switch ($ctx.state) {
              case 0:
                $__16 = $ctx.wrapYieldStar(this.map_.entries()[Symbol.iterator]());
                $ctx.sent = void 0;
                $ctx.action = 'next';
                $ctx.state = 12;
                break;
              case 12:
                $__17 = $__16[$ctx.action]($ctx.sentIgnoreThrow);
                $ctx.state = 9;
                break;
              case 9:
                $ctx.state = ($__17.done) ? 3 : 2;
                break;
              case 3:
                $ctx.sent = $__17.value;
                $ctx.state = -2;
                break;
              case 2:
                $ctx.state = 12;
                return $__17.value;
              default:
                return $ctx.end();
            }
        }, $__15, this);
      })
    }, {});
  }());
  Object.defineProperty(Set.prototype, Symbol.iterator, {
    configurable: true,
    writable: true,
    value: Set.prototype.values
  });
  Object.defineProperty(Set.prototype, 'keys', {
    configurable: true,
    writable: true,
    value: Set.prototype.values
  });
  function polyfillSet(global) {
    var $__11 = global,
        Object = $__11.Object,
        Symbol = $__11.Symbol;
    if (!global.Set)
      global.Set = Set;
    var setPrototype = global.Set.prototype;
    if (setPrototype.values) {
      maybeAddIterator(setPrototype, setPrototype.values, Symbol);
      maybeAddIterator(Object.getPrototypeOf(new global.Set().values()), function() {
        return this;
      }, Symbol);
    }
  }
  registerPolyfill(polyfillSet);
  return {
    get Set() {
      return Set;
    },
    get polyfillSet() {
      return polyfillSet;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Set.js" + '');
System.registerModule("traceur-runtime@0.0.88/node_modules/rsvp/lib/rsvp/asap.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/node_modules/rsvp/lib/rsvp/asap.js";
  var len = 0;
  function asap(callback, arg) {
    queue[len] = callback;
    queue[len + 1] = arg;
    len += 2;
    if (len === 2) {
      scheduleFlush();
    }
  }
  var $__default = asap;
  var browserGlobal = (typeof window !== 'undefined') ? window : {};
  var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
  var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';
  function useNextTick() {
    return function() {
      process.nextTick(flush);
    };
  }
  function useMutationObserver() {
    var iterations = 0;
    var observer = new BrowserMutationObserver(flush);
    var node = document.createTextNode('');
    observer.observe(node, {characterData: true});
    return function() {
      node.data = (iterations = ++iterations % 2);
    };
  }
  function useMessageChannel() {
    var channel = new MessageChannel();
    channel.port1.onmessage = flush;
    return function() {
      channel.port2.postMessage(0);
    };
  }
  function useSetTimeout() {
    return function() {
      setTimeout(flush, 1);
    };
  }
  var queue = new Array(1000);
  function flush() {
    for (var i = 0; i < len; i += 2) {
      var callback = queue[i];
      var arg = queue[i + 1];
      callback(arg);
      queue[i] = undefined;
      queue[i + 1] = undefined;
    }
    len = 0;
  }
  var scheduleFlush;
  if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
    scheduleFlush = useNextTick();
  } else if (BrowserMutationObserver) {
    scheduleFlush = useMutationObserver();
  } else if (isWorker) {
    scheduleFlush = useMessageChannel();
  } else {
    scheduleFlush = useSetTimeout();
  }
  return {get default() {
      return $__default;
    }};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Promise.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Promise.js";
  var async = System.get("traceur-runtime@0.0.88/node_modules/rsvp/lib/rsvp/asap.js").default;
  var registerPolyfill = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js").registerPolyfill;
  var promiseRaw = {};
  function isPromise(x) {
    return x && typeof x === 'object' && x.status_ !== undefined;
  }
  function idResolveHandler(x) {
    return x;
  }
  function idRejectHandler(x) {
    throw x;
  }
  function chain(promise) {
    var onResolve = arguments[1] !== (void 0) ? arguments[1] : idResolveHandler;
    var onReject = arguments[2] !== (void 0) ? arguments[2] : idRejectHandler;
    var deferred = getDeferred(promise.constructor);
    switch (promise.status_) {
      case undefined:
        throw TypeError;
      case 0:
        promise.onResolve_.push(onResolve, deferred);
        promise.onReject_.push(onReject, deferred);
        break;
      case +1:
        promiseEnqueue(promise.value_, [onResolve, deferred]);
        break;
      case -1:
        promiseEnqueue(promise.value_, [onReject, deferred]);
        break;
    }
    return deferred.promise;
  }
  function getDeferred(C) {
    if (this === $Promise) {
      var promise = promiseInit(new $Promise(promiseRaw));
      return {
        promise: promise,
        resolve: (function(x) {
          promiseResolve(promise, x);
        }),
        reject: (function(r) {
          promiseReject(promise, r);
        })
      };
    } else {
      var result = {};
      result.promise = new C((function(resolve, reject) {
        result.resolve = resolve;
        result.reject = reject;
      }));
      return result;
    }
  }
  function promiseSet(promise, status, value, onResolve, onReject) {
    promise.status_ = status;
    promise.value_ = value;
    promise.onResolve_ = onResolve;
    promise.onReject_ = onReject;
    return promise;
  }
  function promiseInit(promise) {
    return promiseSet(promise, 0, undefined, [], []);
  }
  var Promise = (function() {
    function Promise(resolver) {
      if (resolver === promiseRaw)
        return ;
      if (typeof resolver !== 'function')
        throw new TypeError;
      var promise = promiseInit(this);
      try {
        resolver((function(x) {
          promiseResolve(promise, x);
        }), (function(r) {
          promiseReject(promise, r);
        }));
      } catch (e) {
        promiseReject(promise, e);
      }
    }
    return ($traceurRuntime.createClass)(Promise, {
      catch: function(onReject) {
        return this.then(undefined, onReject);
      },
      then: function(onResolve, onReject) {
        if (typeof onResolve !== 'function')
          onResolve = idResolveHandler;
        if (typeof onReject !== 'function')
          onReject = idRejectHandler;
        var that = this;
        var constructor = this.constructor;
        return chain(this, function(x) {
          x = promiseCoerce(constructor, x);
          return x === that ? onReject(new TypeError) : isPromise(x) ? x.then(onResolve, onReject) : onResolve(x);
        }, onReject);
      }
    }, {
      resolve: function(x) {
        if (this === $Promise) {
          if (isPromise(x)) {
            return x;
          }
          return promiseSet(new $Promise(promiseRaw), +1, x);
        } else {
          return new this(function(resolve, reject) {
            resolve(x);
          });
        }
      },
      reject: function(r) {
        if (this === $Promise) {
          return promiseSet(new $Promise(promiseRaw), -1, r);
        } else {
          return new this((function(resolve, reject) {
            reject(r);
          }));
        }
      },
      all: function(values) {
        var deferred = getDeferred(this);
        var resolutions = [];
        try {
          var makeCountdownFunction = function(i) {
            return (function(x) {
              resolutions[i] = x;
              if (--count === 0)
                deferred.resolve(resolutions);
            });
          };
          var count = 0;
          var i = 0;
          var $__6 = true;
          var $__7 = false;
          var $__8 = undefined;
          try {
            for (var $__4 = void 0,
                $__3 = (values)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__6 = ($__4 = $__3.next()).done); $__6 = true) {
              var value = $__4.value;
              {
                var countdownFunction = makeCountdownFunction(i);
                this.resolve(value).then(countdownFunction, (function(r) {
                  deferred.reject(r);
                }));
                ++i;
                ++count;
              }
            }
          } catch ($__9) {
            $__7 = true;
            $__8 = $__9;
          } finally {
            try {
              if (!$__6 && $__3.return != null) {
                $__3.return();
              }
            } finally {
              if ($__7) {
                throw $__8;
              }
            }
          }
          if (count === 0) {
            deferred.resolve(resolutions);
          }
        } catch (e) {
          deferred.reject(e);
        }
        return deferred.promise;
      },
      race: function(values) {
        var deferred = getDeferred(this);
        try {
          for (var i = 0; i < values.length; i++) {
            this.resolve(values[i]).then((function(x) {
              deferred.resolve(x);
            }), (function(r) {
              deferred.reject(r);
            }));
          }
        } catch (e) {
          deferred.reject(e);
        }
        return deferred.promise;
      }
    });
  }());
  var $Promise = Promise;
  var $PromiseReject = $Promise.reject;
  function promiseResolve(promise, x) {
    promiseDone(promise, +1, x, promise.onResolve_);
  }
  function promiseReject(promise, r) {
    promiseDone(promise, -1, r, promise.onReject_);
  }
  function promiseDone(promise, status, value, reactions) {
    if (promise.status_ !== 0)
      return ;
    promiseEnqueue(value, reactions);
    promiseSet(promise, status, value);
  }
  function promiseEnqueue(value, tasks) {
    async((function() {
      for (var i = 0; i < tasks.length; i += 2) {
        promiseHandle(value, tasks[i], tasks[i + 1]);
      }
    }));
  }
  function promiseHandle(value, handler, deferred) {
    try {
      var result = handler(value);
      if (result === deferred.promise)
        throw new TypeError;
      else if (isPromise(result))
        chain(result, deferred.resolve, deferred.reject);
      else
        deferred.resolve(result);
    } catch (e) {
      try {
        deferred.reject(e);
      } catch (e) {}
    }
  }
  var thenableSymbol = '@@thenable';
  function isObject(x) {
    return x && (typeof x === 'object' || typeof x === 'function');
  }
  function promiseCoerce(constructor, x) {
    if (!isPromise(x) && isObject(x)) {
      var then;
      try {
        then = x.then;
      } catch (r) {
        var promise = $PromiseReject.call(constructor, r);
        x[thenableSymbol] = promise;
        return promise;
      }
      if (typeof then === 'function') {
        var p = x[thenableSymbol];
        if (p) {
          return p;
        } else {
          var deferred = getDeferred(constructor);
          x[thenableSymbol] = deferred.promise;
          try {
            then.call(x, deferred.resolve, deferred.reject);
          } catch (r) {
            deferred.reject(r);
          }
          return deferred.promise;
        }
      }
    }
    return x;
  }
  function polyfillPromise(global) {
    if (!global.Promise)
      global.Promise = Promise;
  }
  registerPolyfill(polyfillPromise);
  return {
    get Promise() {
      return Promise;
    },
    get polyfillPromise() {
      return polyfillPromise;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Promise.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/StringIterator.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/StringIterator.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      createIteratorResultObject = $__0.createIteratorResultObject,
      isObject = $__0.isObject;
  var toProperty = $traceurRuntime.toProperty;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var iteratedString = Symbol('iteratedString');
  var stringIteratorNextIndex = Symbol('stringIteratorNextIndex');
  var StringIterator = (function() {
    var $__2;
    function StringIterator() {}
    return ($traceurRuntime.createClass)(StringIterator, ($__2 = {}, Object.defineProperty($__2, "next", {
      value: function() {
        var o = this;
        if (!isObject(o) || !hasOwnProperty.call(o, iteratedString)) {
          throw new TypeError('this must be a StringIterator object');
        }
        var s = o[toProperty(iteratedString)];
        if (s === undefined) {
          return createIteratorResultObject(undefined, true);
        }
        var position = o[toProperty(stringIteratorNextIndex)];
        var len = s.length;
        if (position >= len) {
          o[toProperty(iteratedString)] = undefined;
          return createIteratorResultObject(undefined, true);
        }
        var first = s.charCodeAt(position);
        var resultString;
        if (first < 0xD800 || first > 0xDBFF || position + 1 === len) {
          resultString = String.fromCharCode(first);
        } else {
          var second = s.charCodeAt(position + 1);
          if (second < 0xDC00 || second > 0xDFFF) {
            resultString = String.fromCharCode(first);
          } else {
            resultString = String.fromCharCode(first) + String.fromCharCode(second);
          }
        }
        o[toProperty(stringIteratorNextIndex)] = position + resultString.length;
        return createIteratorResultObject(resultString, false);
      },
      configurable: true,
      enumerable: true,
      writable: true
    }), Object.defineProperty($__2, Symbol.iterator, {
      value: function() {
        return this;
      },
      configurable: true,
      enumerable: true,
      writable: true
    }), $__2), {});
  }());
  function createStringIterator(string) {
    var s = String(string);
    var iterator = Object.create(StringIterator.prototype);
    iterator[toProperty(iteratedString)] = s;
    iterator[toProperty(stringIteratorNextIndex)] = 0;
    return iterator;
  }
  return {get createStringIterator() {
      return createStringIterator;
    }};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/String.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/String.js";
  var createStringIterator = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/StringIterator.js").createStringIterator;
  var $__1 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      maybeAddFunctions = $__1.maybeAddFunctions,
      maybeAddIterator = $__1.maybeAddIterator,
      registerPolyfill = $__1.registerPolyfill;
  var $toString = Object.prototype.toString;
  var $indexOf = String.prototype.indexOf;
  var $lastIndexOf = String.prototype.lastIndexOf;
  function startsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1] : undefined;
    var pos = position ? Number(position) : 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) == start;
  }
  function endsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var pos = stringLength;
    if (arguments.length > 1) {
      var position = arguments[1];
      if (position !== undefined) {
        pos = position ? Number(position) : 0;
        if (isNaN(pos)) {
          pos = 0;
        }
      }
    }
    var end = Math.min(Math.max(pos, 0), stringLength);
    var start = end - searchLength;
    if (start < 0) {
      return false;
    }
    return $lastIndexOf.call(string, searchString, start) == start;
  }
  function includes(search) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    if (search && $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1] : undefined;
    var pos = position ? Number(position) : 0;
    if (pos != pos) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    if (searchLength + start > stringLength) {
      return false;
    }
    return $indexOf.call(string, searchString, pos) != -1;
  }
  function repeat(count) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var n = count ? Number(count) : 0;
    if (isNaN(n)) {
      n = 0;
    }
    if (n < 0 || n == Infinity) {
      throw RangeError();
    }
    if (n == 0) {
      return '';
    }
    var result = '';
    while (n--) {
      result += string;
    }
    return result;
  }
  function codePointAt(position) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var size = string.length;
    var index = position ? Number(position) : 0;
    if (isNaN(index)) {
      index = 0;
    }
    if (index < 0 || index >= size) {
      return undefined;
    }
    var first = string.charCodeAt(index);
    var second;
    if (first >= 0xD800 && first <= 0xDBFF && size > index + 1) {
      second = string.charCodeAt(index + 1);
      if (second >= 0xDC00 && second <= 0xDFFF) {
        return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
      }
    }
    return first;
  }
  function raw(callsite) {
    var raw = callsite.raw;
    var len = raw.length >>> 0;
    if (len === 0)
      return '';
    var s = '';
    var i = 0;
    while (true) {
      s += raw[i];
      if (i + 1 === len)
        return s;
      s += arguments[++i];
    }
  }
  function fromCodePoint(_) {
    var codeUnits = [];
    var floor = Math.floor;
    var highSurrogate;
    var lowSurrogate;
    var index = -1;
    var length = arguments.length;
    if (!length) {
      return '';
    }
    while (++index < length) {
      var codePoint = Number(arguments[index]);
      if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF || floor(codePoint) != codePoint) {
        throw RangeError('Invalid code point: ' + codePoint);
      }
      if (codePoint <= 0xFFFF) {
        codeUnits.push(codePoint);
      } else {
        codePoint -= 0x10000;
        highSurrogate = (codePoint >> 10) + 0xD800;
        lowSurrogate = (codePoint % 0x400) + 0xDC00;
        codeUnits.push(highSurrogate, lowSurrogate);
      }
    }
    return String.fromCharCode.apply(null, codeUnits);
  }
  function stringPrototypeIterator() {
    var o = $traceurRuntime.checkObjectCoercible(this);
    var s = String(o);
    return createStringIterator(s);
  }
  function polyfillString(global) {
    var String = global.String;
    maybeAddFunctions(String.prototype, ['codePointAt', codePointAt, 'endsWith', endsWith, 'includes', includes, 'repeat', repeat, 'startsWith', startsWith]);
    maybeAddFunctions(String, ['fromCodePoint', fromCodePoint, 'raw', raw]);
    maybeAddIterator(String.prototype, stringPrototypeIterator, Symbol);
  }
  registerPolyfill(polyfillString);
  return {
    get startsWith() {
      return startsWith;
    },
    get endsWith() {
      return endsWith;
    },
    get includes() {
      return includes;
    },
    get repeat() {
      return repeat;
    },
    get codePointAt() {
      return codePointAt;
    },
    get raw() {
      return raw;
    },
    get fromCodePoint() {
      return fromCodePoint;
    },
    get stringPrototypeIterator() {
      return stringPrototypeIterator;
    },
    get polyfillString() {
      return polyfillString;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/String.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/ArrayIterator.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/ArrayIterator.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      toObject = $__0.toObject,
      toUint32 = $__0.toUint32,
      createIteratorResultObject = $__0.createIteratorResultObject;
  var ARRAY_ITERATOR_KIND_KEYS = 1;
  var ARRAY_ITERATOR_KIND_VALUES = 2;
  var ARRAY_ITERATOR_KIND_ENTRIES = 3;
  var ArrayIterator = (function() {
    var $__2;
    function ArrayIterator() {}
    return ($traceurRuntime.createClass)(ArrayIterator, ($__2 = {}, Object.defineProperty($__2, "next", {
      value: function() {
        var iterator = toObject(this);
        var array = iterator.iteratorObject_;
        if (!array) {
          throw new TypeError('Object is not an ArrayIterator');
        }
        var index = iterator.arrayIteratorNextIndex_;
        var itemKind = iterator.arrayIterationKind_;
        var length = toUint32(array.length);
        if (index >= length) {
          iterator.arrayIteratorNextIndex_ = Infinity;
          return createIteratorResultObject(undefined, true);
        }
        iterator.arrayIteratorNextIndex_ = index + 1;
        if (itemKind == ARRAY_ITERATOR_KIND_VALUES)
          return createIteratorResultObject(array[index], false);
        if (itemKind == ARRAY_ITERATOR_KIND_ENTRIES)
          return createIteratorResultObject([index, array[index]], false);
        return createIteratorResultObject(index, false);
      },
      configurable: true,
      enumerable: true,
      writable: true
    }), Object.defineProperty($__2, Symbol.iterator, {
      value: function() {
        return this;
      },
      configurable: true,
      enumerable: true,
      writable: true
    }), $__2), {});
  }());
  function createArrayIterator(array, kind) {
    var object = toObject(array);
    var iterator = new ArrayIterator;
    iterator.iteratorObject_ = object;
    iterator.arrayIteratorNextIndex_ = 0;
    iterator.arrayIterationKind_ = kind;
    return iterator;
  }
  function entries() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_ENTRIES);
  }
  function keys() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_KEYS);
  }
  function values() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_VALUES);
  }
  return {
    get entries() {
      return entries;
    },
    get keys() {
      return keys;
    },
    get values() {
      return values;
    }
  };
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Array.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Array.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/ArrayIterator.js"),
      entries = $__0.entries,
      keys = $__0.keys,
      jsValues = $__0.values;
  var $__1 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      checkIterable = $__1.checkIterable,
      isCallable = $__1.isCallable,
      isConstructor = $__1.isConstructor,
      maybeAddFunctions = $__1.maybeAddFunctions,
      maybeAddIterator = $__1.maybeAddIterator,
      registerPolyfill = $__1.registerPolyfill,
      toInteger = $__1.toInteger,
      toLength = $__1.toLength,
      toObject = $__1.toObject;
  function from(arrLike) {
    var mapFn = arguments[1];
    var thisArg = arguments[2];
    var C = this;
    var items = toObject(arrLike);
    var mapping = mapFn !== undefined;
    var k = 0;
    var arr,
        len;
    if (mapping && !isCallable(mapFn)) {
      throw TypeError();
    }
    if (checkIterable(items)) {
      arr = isConstructor(C) ? new C() : [];
      var $__5 = true;
      var $__6 = false;
      var $__7 = undefined;
      try {
        for (var $__3 = void 0,
            $__2 = (items)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
          var item = $__3.value;
          {
            if (mapping) {
              arr[k] = mapFn.call(thisArg, item, k);
            } else {
              arr[k] = item;
            }
            k++;
          }
        }
      } catch ($__8) {
        $__6 = true;
        $__7 = $__8;
      } finally {
        try {
          if (!$__5 && $__2.return != null) {
            $__2.return();
          }
        } finally {
          if ($__6) {
            throw $__7;
          }
        }
      }
      arr.length = k;
      return arr;
    }
    len = toLength(items.length);
    arr = isConstructor(C) ? new C(len) : new Array(len);
    for (; k < len; k++) {
      if (mapping) {
        arr[k] = typeof thisArg === 'undefined' ? mapFn(items[k], k) : mapFn.call(thisArg, items[k], k);
      } else {
        arr[k] = items[k];
      }
    }
    arr.length = len;
    return arr;
  }
  function of() {
    for (var items = [],
        $__9 = 0; $__9 < arguments.length; $__9++)
      items[$__9] = arguments[$__9];
    var C = this;
    var len = items.length;
    var arr = isConstructor(C) ? new C(len) : new Array(len);
    for (var k = 0; k < len; k++) {
      arr[k] = items[k];
    }
    arr.length = len;
    return arr;
  }
  function fill(value) {
    var start = arguments[1] !== (void 0) ? arguments[1] : 0;
    var end = arguments[2];
    var object = toObject(this);
    var len = toLength(object.length);
    var fillStart = toInteger(start);
    var fillEnd = end !== undefined ? toInteger(end) : len;
    fillStart = fillStart < 0 ? Math.max(len + fillStart, 0) : Math.min(fillStart, len);
    fillEnd = fillEnd < 0 ? Math.max(len + fillEnd, 0) : Math.min(fillEnd, len);
    while (fillStart < fillEnd) {
      object[fillStart] = value;
      fillStart++;
    }
    return object;
  }
  function find(predicate) {
    var thisArg = arguments[1];
    return findHelper(this, predicate, thisArg);
  }
  function findIndex(predicate) {
    var thisArg = arguments[1];
    return findHelper(this, predicate, thisArg, true);
  }
  function findHelper(self, predicate) {
    var thisArg = arguments[2];
    var returnIndex = arguments[3] !== (void 0) ? arguments[3] : false;
    var object = toObject(self);
    var len = toLength(object.length);
    if (!isCallable(predicate)) {
      throw TypeError();
    }
    for (var i = 0; i < len; i++) {
      var value = object[i];
      if (predicate.call(thisArg, value, i, object)) {
        return returnIndex ? i : value;
      }
    }
    return returnIndex ? -1 : undefined;
  }
  function polyfillArray(global) {
    var $__10 = global,
        Array = $__10.Array,
        Object = $__10.Object,
        Symbol = $__10.Symbol;
    var values = jsValues;
    if (Symbol && Symbol.iterator && Array.prototype[Symbol.iterator]) {
      values = Array.prototype[Symbol.iterator];
    }
    maybeAddFunctions(Array.prototype, ['entries', entries, 'keys', keys, 'values', values, 'fill', fill, 'find', find, 'findIndex', findIndex]);
    maybeAddFunctions(Array, ['from', from, 'of', of]);
    maybeAddIterator(Array.prototype, values, Symbol);
    maybeAddIterator(Object.getPrototypeOf([].values()), function() {
      return this;
    }, Symbol);
  }
  registerPolyfill(polyfillArray);
  return {
    get from() {
      return from;
    },
    get of() {
      return of;
    },
    get fill() {
      return fill;
    },
    get find() {
      return find;
    },
    get findIndex() {
      return findIndex;
    },
    get polyfillArray() {
      return polyfillArray;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Array.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Object.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Object.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      maybeAddFunctions = $__0.maybeAddFunctions,
      registerPolyfill = $__0.registerPolyfill;
  var $__1 = $traceurRuntime,
      defineProperty = $__1.defineProperty,
      getOwnPropertyDescriptor = $__1.getOwnPropertyDescriptor,
      getOwnPropertyNames = $__1.getOwnPropertyNames,
      isPrivateName = $__1.isPrivateName,
      keys = $__1.keys;
  function is(left, right) {
    if (left === right)
      return left !== 0 || 1 / left === 1 / right;
    return left !== left && right !== right;
  }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      var props = source == null ? [] : keys(source);
      var p = void 0,
          length = props.length;
      for (p = 0; p < length; p++) {
        var name = props[p];
        if (isPrivateName(name))
          continue;
        target[name] = source[name];
      }
    }
    return target;
  }
  function mixin(target, source) {
    var props = getOwnPropertyNames(source);
    var p,
        descriptor,
        length = props.length;
    for (p = 0; p < length; p++) {
      var name = props[p];
      if (isPrivateName(name))
        continue;
      descriptor = getOwnPropertyDescriptor(source, props[p]);
      defineProperty(target, props[p], descriptor);
    }
    return target;
  }
  function polyfillObject(global) {
    var Object = global.Object;
    maybeAddFunctions(Object, ['assign', assign, 'is', is, 'mixin', mixin]);
  }
  registerPolyfill(polyfillObject);
  return {
    get is() {
      return is;
    },
    get assign() {
      return assign;
    },
    get mixin() {
      return mixin;
    },
    get polyfillObject() {
      return polyfillObject;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Object.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Number.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Number.js";
  var $__0 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      isNumber = $__0.isNumber,
      maybeAddConsts = $__0.maybeAddConsts,
      maybeAddFunctions = $__0.maybeAddFunctions,
      registerPolyfill = $__0.registerPolyfill,
      toInteger = $__0.toInteger;
  var $abs = Math.abs;
  var $isFinite = isFinite;
  var $isNaN = isNaN;
  var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
  var MIN_SAFE_INTEGER = -Math.pow(2, 53) + 1;
  var EPSILON = Math.pow(2, -52);
  function NumberIsFinite(number) {
    return isNumber(number) && $isFinite(number);
  }
  function isInteger(number) {
    return NumberIsFinite(number) && toInteger(number) === number;
  }
  function NumberIsNaN(number) {
    return isNumber(number) && $isNaN(number);
  }
  function isSafeInteger(number) {
    if (NumberIsFinite(number)) {
      var integral = toInteger(number);
      if (integral === number)
        return $abs(integral) <= MAX_SAFE_INTEGER;
    }
    return false;
  }
  function polyfillNumber(global) {
    var Number = global.Number;
    maybeAddConsts(Number, ['MAX_SAFE_INTEGER', MAX_SAFE_INTEGER, 'MIN_SAFE_INTEGER', MIN_SAFE_INTEGER, 'EPSILON', EPSILON]);
    maybeAddFunctions(Number, ['isFinite', NumberIsFinite, 'isInteger', isInteger, 'isNaN', NumberIsNaN, 'isSafeInteger', isSafeInteger]);
  }
  registerPolyfill(polyfillNumber);
  return {
    get MAX_SAFE_INTEGER() {
      return MAX_SAFE_INTEGER;
    },
    get MIN_SAFE_INTEGER() {
      return MIN_SAFE_INTEGER;
    },
    get EPSILON() {
      return EPSILON;
    },
    get isFinite() {
      return NumberIsFinite;
    },
    get isInteger() {
      return isInteger;
    },
    get isNaN() {
      return NumberIsNaN;
    },
    get isSafeInteger() {
      return isSafeInteger;
    },
    get polyfillNumber() {
      return polyfillNumber;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Number.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/fround.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/fround.js";
  var $isFinite = isFinite;
  var $isNaN = isNaN;
  var $__0 = Math,
      LN2 = $__0.LN2,
      abs = $__0.abs,
      floor = $__0.floor,
      log = $__0.log,
      min = $__0.min,
      pow = $__0.pow;
  function packIEEE754(v, ebits, fbits) {
    var bias = (1 << (ebits - 1)) - 1,
        s,
        e,
        f,
        ln,
        i,
        bits,
        str,
        bytes;
    function roundToEven(n) {
      var w = floor(n),
          f = n - w;
      if (f < 0.5)
        return w;
      if (f > 0.5)
        return w + 1;
      return w % 2 ? w + 1 : w;
    }
    if (v !== v) {
      e = (1 << ebits) - 1;
      f = pow(2, fbits - 1);
      s = 0;
    } else if (v === Infinity || v === -Infinity) {
      e = (1 << ebits) - 1;
      f = 0;
      s = (v < 0) ? 1 : 0;
    } else if (v === 0) {
      e = 0;
      f = 0;
      s = (1 / v === -Infinity) ? 1 : 0;
    } else {
      s = v < 0;
      v = abs(v);
      if (v >= pow(2, 1 - bias)) {
        e = min(floor(log(v) / LN2), 1023);
        f = roundToEven(v / pow(2, e) * pow(2, fbits));
        if (f / pow(2, fbits) >= 2) {
          e = e + 1;
          f = 1;
        }
        if (e > bias) {
          e = (1 << ebits) - 1;
          f = 0;
        } else {
          e = e + bias;
          f = f - pow(2, fbits);
        }
      } else {
        e = 0;
        f = roundToEven(v / pow(2, 1 - bias - fbits));
      }
    }
    bits = [];
    for (i = fbits; i; i -= 1) {
      bits.push(f % 2 ? 1 : 0);
      f = floor(f / 2);
    }
    for (i = ebits; i; i -= 1) {
      bits.push(e % 2 ? 1 : 0);
      e = floor(e / 2);
    }
    bits.push(s ? 1 : 0);
    bits.reverse();
    str = bits.join('');
    bytes = [];
    while (str.length) {
      bytes.push(parseInt(str.substring(0, 8), 2));
      str = str.substring(8);
    }
    return bytes;
  }
  function unpackIEEE754(bytes, ebits, fbits) {
    var bits = [],
        i,
        j,
        b,
        str,
        bias,
        s,
        e,
        f;
    for (i = bytes.length; i; i -= 1) {
      b = bytes[i - 1];
      for (j = 8; j; j -= 1) {
        bits.push(b % 2 ? 1 : 0);
        b = b >> 1;
      }
    }
    bits.reverse();
    str = bits.join('');
    bias = (1 << (ebits - 1)) - 1;
    s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
    e = parseInt(str.substring(1, 1 + ebits), 2);
    f = parseInt(str.substring(1 + ebits), 2);
    if (e === (1 << ebits) - 1) {
      return f !== 0 ? NaN : s * Infinity;
    } else if (e > 0) {
      return s * pow(2, e - bias) * (1 + f / pow(2, fbits));
    } else if (f !== 0) {
      return s * pow(2, -(bias - 1)) * (f / pow(2, fbits));
    } else {
      return s < 0 ? -0 : 0;
    }
  }
  function unpackF32(b) {
    return unpackIEEE754(b, 8, 23);
  }
  function packF32(v) {
    return packIEEE754(v, 8, 23);
  }
  function fround(x) {
    if (x === 0 || !$isFinite(x) || $isNaN(x)) {
      return x;
    }
    return unpackF32(packF32(Number(x)));
  }
  return {get fround() {
      return fround;
    }};
});
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/Math.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/Math.js";
  var jsFround = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/fround.js").fround;
  var $__1 = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js"),
      maybeAddFunctions = $__1.maybeAddFunctions,
      registerPolyfill = $__1.registerPolyfill,
      toUint32 = $__1.toUint32;
  var $isFinite = isFinite;
  var $isNaN = isNaN;
  var $__2 = Math,
      abs = $__2.abs,
      ceil = $__2.ceil,
      exp = $__2.exp,
      floor = $__2.floor,
      log = $__2.log,
      pow = $__2.pow,
      sqrt = $__2.sqrt;
  function clz32(x) {
    x = toUint32(+x);
    if (x == 0)
      return 32;
    var result = 0;
    if ((x & 0xFFFF0000) === 0) {
      x <<= 16;
      result += 16;
    }
    ;
    if ((x & 0xFF000000) === 0) {
      x <<= 8;
      result += 8;
    }
    ;
    if ((x & 0xF0000000) === 0) {
      x <<= 4;
      result += 4;
    }
    ;
    if ((x & 0xC0000000) === 0) {
      x <<= 2;
      result += 2;
    }
    ;
    if ((x & 0x80000000) === 0) {
      x <<= 1;
      result += 1;
    }
    ;
    return result;
  }
  function imul(x, y) {
    x = toUint32(+x);
    y = toUint32(+y);
    var xh = (x >>> 16) & 0xffff;
    var xl = x & 0xffff;
    var yh = (y >>> 16) & 0xffff;
    var yl = y & 0xffff;
    return xl * yl + (((xh * yl + xl * yh) << 16) >>> 0) | 0;
  }
  function sign(x) {
    x = +x;
    if (x > 0)
      return 1;
    if (x < 0)
      return -1;
    return x;
  }
  function log10(x) {
    return log(x) * 0.434294481903251828;
  }
  function log2(x) {
    return log(x) * 1.442695040888963407;
  }
  function log1p(x) {
    x = +x;
    if (x < -1 || $isNaN(x)) {
      return NaN;
    }
    if (x === 0 || x === Infinity) {
      return x;
    }
    if (x === -1) {
      return -Infinity;
    }
    var result = 0;
    var n = 50;
    if (x < 0 || x > 1) {
      return log(1 + x);
    }
    for (var i = 1; i < n; i++) {
      if ((i % 2) === 0) {
        result -= pow(x, i) / i;
      } else {
        result += pow(x, i) / i;
      }
    }
    return result;
  }
  function expm1(x) {
    x = +x;
    if (x === -Infinity) {
      return -1;
    }
    if (!$isFinite(x) || x === 0) {
      return x;
    }
    return exp(x) - 1;
  }
  function cosh(x) {
    x = +x;
    if (x === 0) {
      return 1;
    }
    if ($isNaN(x)) {
      return NaN;
    }
    if (!$isFinite(x)) {
      return Infinity;
    }
    if (x < 0) {
      x = -x;
    }
    if (x > 21) {
      return exp(x) / 2;
    }
    return (exp(x) + exp(-x)) / 2;
  }
  function sinh(x) {
    x = +x;
    if (!$isFinite(x) || x === 0) {
      return x;
    }
    return (exp(x) - exp(-x)) / 2;
  }
  function tanh(x) {
    x = +x;
    if (x === 0)
      return x;
    if (!$isFinite(x))
      return sign(x);
    var exp1 = exp(x);
    var exp2 = exp(-x);
    return (exp1 - exp2) / (exp1 + exp2);
  }
  function acosh(x) {
    x = +x;
    if (x < 1)
      return NaN;
    if (!$isFinite(x))
      return x;
    return log(x + sqrt(x + 1) * sqrt(x - 1));
  }
  function asinh(x) {
    x = +x;
    if (x === 0 || !$isFinite(x))
      return x;
    if (x > 0)
      return log(x + sqrt(x * x + 1));
    return -log(-x + sqrt(x * x + 1));
  }
  function atanh(x) {
    x = +x;
    if (x === -1) {
      return -Infinity;
    }
    if (x === 1) {
      return Infinity;
    }
    if (x === 0) {
      return x;
    }
    if ($isNaN(x) || x < -1 || x > 1) {
      return NaN;
    }
    return 0.5 * log((1 + x) / (1 - x));
  }
  function hypot(x, y) {
    var length = arguments.length;
    var args = new Array(length);
    var max = 0;
    for (var i = 0; i < length; i++) {
      var n = arguments[i];
      n = +n;
      if (n === Infinity || n === -Infinity)
        return Infinity;
      n = abs(n);
      if (n > max)
        max = n;
      args[i] = n;
    }
    if (max === 0)
      max = 1;
    var sum = 0;
    var compensation = 0;
    for (var i = 0; i < length; i++) {
      var n = args[i] / max;
      var summand = n * n - compensation;
      var preliminary = sum + summand;
      compensation = (preliminary - sum) - summand;
      sum = preliminary;
    }
    return sqrt(sum) * max;
  }
  function trunc(x) {
    x = +x;
    if (x > 0)
      return floor(x);
    if (x < 0)
      return ceil(x);
    return x;
  }
  var fround,
      f32;
  if (typeof Float32Array === 'function') {
    f32 = new Float32Array(1);
    fround = function(x) {
      f32[0] = Number(x);
      return f32[0];
    };
  } else {
    fround = jsFround;
  }
  function cbrt(x) {
    x = +x;
    if (x === 0)
      return x;
    var negate = x < 0;
    if (negate)
      x = -x;
    var result = pow(x, 1 / 3);
    return negate ? -result : result;
  }
  function polyfillMath(global) {
    var Math = global.Math;
    maybeAddFunctions(Math, ['acosh', acosh, 'asinh', asinh, 'atanh', atanh, 'cbrt', cbrt, 'clz32', clz32, 'cosh', cosh, 'expm1', expm1, 'fround', fround, 'hypot', hypot, 'imul', imul, 'log10', log10, 'log1p', log1p, 'log2', log2, 'sign', sign, 'sinh', sinh, 'tanh', tanh, 'trunc', trunc]);
  }
  registerPolyfill(polyfillMath);
  return {
    get clz32() {
      return clz32;
    },
    get imul() {
      return imul;
    },
    get sign() {
      return sign;
    },
    get log10() {
      return log10;
    },
    get log2() {
      return log2;
    },
    get log1p() {
      return log1p;
    },
    get expm1() {
      return expm1;
    },
    get cosh() {
      return cosh;
    },
    get sinh() {
      return sinh;
    },
    get tanh() {
      return tanh;
    },
    get acosh() {
      return acosh;
    },
    get asinh() {
      return asinh;
    },
    get atanh() {
      return atanh;
    },
    get hypot() {
      return hypot;
    },
    get trunc() {
      return trunc;
    },
    get fround() {
      return fround;
    },
    get cbrt() {
      return cbrt;
    },
    get polyfillMath() {
      return polyfillMath;
    }
  };
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/Math.js" + '');
System.registerModule("traceur-runtime@0.0.88/src/runtime/polyfills/polyfills.js", [], function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.88/src/runtime/polyfills/polyfills.js";
  var polyfillAll = System.get("traceur-runtime@0.0.88/src/runtime/polyfills/utils.js").polyfillAll;
  polyfillAll(Reflect.global);
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
    polyfillAll(global);
  };
  return {};
});
System.get("traceur-runtime@0.0.88/src/runtime/polyfills/polyfills.js" + '');

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
    if (!(name in defined))
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
        if (depEntry.module.exports && depEntry.module.exports.__esModule)
          depExports = depEntry.module.exports;
        else
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
    if (!entry || entry.evaluated || !entry.declarative)
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

    var module = entry.module.exports;

    if (!module || !entry.declarative && module.__esModule !== true)
      module = { 'default': module, __useDefault: true };

    // return the defined module object
    return modules[name] = module;
  };

  return function(mains, declare) {

    var System;
    var System = {
      register: register, 
      get: load, 
      set: function(name, module) {
        modules[name] = module; 
      },
      newModule: function(module) {
        return module;
      },
      global: global 
    };
    System.set('@empty', {});

    declare(System);

    for (var i = 0; i < mains.length; i++)
      load(mains[i]);
  }

})(typeof window != 'undefined' ? window : global)
/* (['mainModule'], function(System) {
  System.register(...);
}); */

(['main'], function(System) {

System.register("npm:eventemitter3@1.1.0/index", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var prefix = typeof Object.create !== 'function' ? '~' : false;
  function EE(fn, context, once) {
    this.fn = fn;
    this.context = context;
    this.once = once || false;
  }
  function EventEmitter() {}
  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype.listeners = function listeners(event, exists) {
    var evt = prefix ? prefix + event : event,
        available = this._events && this._events[evt];
    if (exists)
      return !!available;
    if (!available)
      return [];
    if (this._events[evt].fn)
      return [this._events[evt].fn];
    for (var i = 0,
        l = this._events[evt].length,
        ee = new Array(l); i < l; i++) {
      ee[i] = this._events[evt][i].fn;
    }
    return ee;
  };
  EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
    var evt = prefix ? prefix + event : event;
    if (!this._events || !this._events[evt])
      return false;
    var listeners = this._events[evt],
        len = arguments.length,
        args,
        i;
    if ('function' === typeof listeners.fn) {
      if (listeners.once)
        this.removeListener(event, listeners.fn, undefined, true);
      switch (len) {
        case 1:
          return listeners.fn.call(listeners.context), true;
        case 2:
          return listeners.fn.call(listeners.context, a1), true;
        case 3:
          return listeners.fn.call(listeners.context, a1, a2), true;
        case 4:
          return listeners.fn.call(listeners.context, a1, a2, a3), true;
        case 5:
          return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
        case 6:
          return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
      }
      for (i = 1, args = new Array(len - 1); i < len; i++) {
        args[i - 1] = arguments[i];
      }
      listeners.fn.apply(listeners.context, args);
    } else {
      var length = listeners.length,
          j;
      for (i = 0; i < length; i++) {
        if (listeners[i].once)
          this.removeListener(event, listeners[i].fn, undefined, true);
        switch (len) {
          case 1:
            listeners[i].fn.call(listeners[i].context);
            break;
          case 2:
            listeners[i].fn.call(listeners[i].context, a1);
            break;
          case 3:
            listeners[i].fn.call(listeners[i].context, a1, a2);
            break;
          default:
            if (!args)
              for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
            listeners[i].fn.apply(listeners[i].context, args);
        }
      }
    }
    return true;
  };
  EventEmitter.prototype.on = function on(event, fn, context) {
    var listener = new EE(fn, context || this),
        evt = prefix ? prefix + event : event;
    if (!this._events)
      this._events = prefix ? {} : Object.create(null);
    if (!this._events[evt])
      this._events[evt] = listener;
    else {
      if (!this._events[evt].fn)
        this._events[evt].push(listener);
      else
        this._events[evt] = [this._events[evt], listener];
    }
    return this;
  };
  EventEmitter.prototype.once = function once(event, fn, context) {
    var listener = new EE(fn, context || this, true),
        evt = prefix ? prefix + event : event;
    if (!this._events)
      this._events = prefix ? {} : Object.create(null);
    if (!this._events[evt])
      this._events[evt] = listener;
    else {
      if (!this._events[evt].fn)
        this._events[evt].push(listener);
      else
        this._events[evt] = [this._events[evt], listener];
    }
    return this;
  };
  EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
    var evt = prefix ? prefix + event : event;
    if (!this._events || !this._events[evt])
      return this;
    var listeners = this._events[evt],
        events = [];
    if (fn) {
      if (listeners.fn) {
        if (listeners.fn !== fn || (once && !listeners.once) || (context && listeners.context !== context)) {
          events.push(listeners);
        }
      } else {
        for (var i = 0,
            length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || (once && !listeners[i].once) || (context && listeners[i].context !== context)) {
            events.push(listeners[i]);
          }
        }
      }
    }
    if (events.length) {
      this._events[evt] = events.length === 1 ? events[0] : events;
    } else {
      delete this._events[evt];
    }
    return this;
  };
  EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
    if (!this._events)
      return this;
    if (event)
      delete this._events[prefix ? prefix + event : event];
    else
      this._events = prefix ? {} : Object.create(null);
    return this;
  };
  EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
  EventEmitter.prototype.addListener = EventEmitter.prototype.on;
  EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
    return this;
  };
  EventEmitter.prefixed = prefix;
  module.exports = EventEmitter;
  global.define = __define;
  return module.exports;
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

System.register("npm:lodash@3.9.1/index", ["github:jspm/nodelibs-process@0.1.1"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  (function(process) {
    ;
    (function() {
      var undefined;
      var VERSION = '3.9.1';
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
      var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,
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
          var valIsNull = value === null,
              valIsUndef = value === undefined,
              valIsReflexive = value === value;
          var othIsNull = other === null,
              othIsUndef = other === undefined,
              othIsReflexive = other === other;
          if ((value > other && !othIsNull) || !valIsReflexive || (valIsNull && !othIsUndef && othIsReflexive) || (valIsUndef && othIsReflexive)) {
            return 1;
          }
          if ((value < other && !valIsNull) || !othIsReflexive || (othIsNull && !valIsUndef && valIsReflexive) || (othIsUndef && valIsReflexive)) {
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
        var document = (document = context.window) ? document.document : null;
        var fnToString = Function.prototype.toString;
        var hasOwnProperty = objectProto.hasOwnProperty;
        var idCounter = 0;
        var objToString = objectProto.toString;
        var oldDash = context._;
        var reIsNative = RegExp('^' + escapeRegExp(fnToString.call(hasOwnProperty)).replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
        var ArrayBuffer = getNative(context, 'ArrayBuffer'),
            bufferSlice = getNative(ArrayBuffer && new ArrayBuffer(0), 'slice'),
            ceil = Math.ceil,
            clearTimeout = context.clearTimeout,
            floor = Math.floor,
            getPrototypeOf = getNative(Object, 'getPrototypeOf'),
            push = arrayProto.push,
            Set = getNative(context, 'Set'),
            setTimeout = context.setTimeout,
            splice = arrayProto.splice,
            Uint8Array = getNative(context, 'Uint8Array'),
            WeakMap = getNative(context, 'WeakMap');
        var Float64Array = (function() {
          try {
            var func = getNative(context, 'Float64Array'),
                result = new func(new ArrayBuffer(10), 0, 1) && func;
          } catch (e) {}
          return result || null;
        }());
        var nativeCreate = getNative(Object, 'create'),
            nativeIsArray = getNative(Array, 'isArray'),
            nativeIsFinite = context.isFinite,
            nativeKeys = getNative(Object, 'keys'),
            nativeMax = Math.max,
            nativeMin = Math.min,
            nativeNow = getNative(Date, 'now'),
            nativeNumIsFinite = getNative(Number, 'isFinite'),
            nativeParseInt = context.parseInt,
            nativeRandom = Math.random;
        var POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
        var MAX_ARRAY_LENGTH = 4294967295,
            MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1,
            HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
        var FLOAT64_BYTES_PER_ELEMENT = Float64Array ? Float64Array.BYTES_PER_ELEMENT : 0;
        var MAX_SAFE_INTEGER = 9007199254740991;
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
          try {
            support.dom = document.createDocumentFragment().nodeType === 11;
          } catch (e) {
            support.dom = false;
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
        function arrayExtremum(array, iteratee, comparator, exValue) {
          var index = -1,
              length = array.length,
              computed = exValue,
              result = computed;
          while (++index < length) {
            var value = array[index],
                current = +iteratee(value);
            if (comparator(current, computed)) {
              computed = current;
              result = value;
            }
          }
          return result;
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
          var index = -1,
              props = keys(source),
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
        function baseAssign(object, source) {
          return source == null ? object : baseCopy(source, keys(source), object);
        }
        function baseAt(collection, props) {
          var index = -1,
              isNil = collection == null,
              isArr = !isNil && isArrayLike(collection),
              length = isArr ? collection.length : 0,
              propsLength = props.length,
              result = Array(propsLength);
          while (++index < propsLength) {
            var key = props[index];
            if (isArr) {
              result[index] = isIndex(key, length) ? collection[key] : undefined;
            } else {
              result[index] = isNil ? undefined : collection[key];
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
          function object() {}
          return function(prototype) {
            if (isObject(prototype)) {
              object.prototype = prototype;
              var result = new object;
              object.prototype = null;
            }
            return result || {};
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
        function baseExtremum(collection, iteratee, comparator, exValue) {
          var computed = exValue,
              result = computed;
          baseEach(collection, function(value, index, collection) {
            var current = +iteratee(value, index, collection);
            if (comparator(current, computed) || (current === exValue && current === result)) {
              computed = current;
              result = value;
            }
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
            if (isObjectLike(value) && isArrayLike(value) && (isStrict || isArray(value) || isArguments(value))) {
              if (isDeep) {
                value = baseFlatten(value, isDeep, isStrict);
              }
              var valIndex = -1,
                  valLength = value.length;
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
          var index = 0,
              length = path.length;
          while (object != null && index < length) {
            object = object[path[index++]];
          }
          return (index && index == length) ? object : undefined;
        }
        function baseIsEqual(value, other, customizer, isLoose, stackA, stackB) {
          if (value === other) {
            return true;
          }
          if (value == null || other == null || (!isObject(value) && !isObject(other))) {
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
            var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
                othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');
            if (objIsWrapped || othIsWrapped) {
              return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, isLoose, stackA, stackB);
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
        function baseIsMatch(object, matchData, customizer) {
          var index = matchData.length,
              length = index,
              noCustomizer = !customizer;
          if (object == null) {
            return !length;
          }
          object = toObject(object);
          while (index--) {
            var data = matchData[index];
            if ((noCustomizer && data[2]) ? data[1] !== object[data[0]] : !(data[0] in object)) {
              return false;
            }
          }
          while (++index < length) {
            data = matchData[index];
            var key = data[0],
                objValue = object[key],
                srcValue = data[1];
            if (noCustomizer && data[2]) {
              if (objValue === undefined && !(key in object)) {
                return false;
              }
            } else {
              var result = customizer ? customizer(objValue, srcValue, key) : undefined;
              if (!(result === undefined ? baseIsEqual(srcValue, objValue, customizer, true) : result)) {
                return false;
              }
            }
          }
          return true;
        }
        function baseMap(collection, iteratee) {
          var index = -1,
              result = isArrayLike(collection) ? Array(collection.length) : [];
          baseEach(collection, function(value, key, collection) {
            result[++index] = iteratee(value, key, collection);
          });
          return result;
        }
        function baseMatches(source) {
          var matchData = getMatchData(source);
          if (matchData.length == 1 && matchData[0][2]) {
            var key = matchData[0][0],
                value = matchData[0][1];
            return function(object) {
              if (object == null) {
                return false;
              }
              return object[key] === value && (value !== undefined || (key in toObject(object)));
            };
          }
          return function(object) {
            return baseIsMatch(object, matchData);
          };
        }
        function baseMatchesProperty(path, srcValue) {
          var isArr = isArray(path),
              isCommon = isKey(path) && isStrictComparable(srcValue),
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
            return object[key] === srcValue ? (srcValue !== undefined || (key in object)) : baseIsEqual(srcValue, object[key], undefined, true);
          };
        }
        function baseMerge(object, source, customizer, stackA, stackB) {
          if (!isObject(object)) {
            return object;
          }
          var isSrcArr = isArrayLike(source) && (isArray(source) || isTypedArray(source)),
              props = isSrcArr ? null : keys(source);
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
              if ((result !== undefined || (isSrcArr && !(key in object))) && (isCommon || (result === result ? (result !== value) : (value === value)))) {
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
            if (isArrayLike(srcValue) && (isArray(srcValue) || isTypedArray(srcValue))) {
              result = isArray(value) ? value : (isArrayLike(value) ? arrayCopy(value) : []);
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
          var length = array ? indexes.length : 0;
          while (length--) {
            var index = indexes[length];
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
              if ((retHighest ? (computed <= value) : (computed < value)) && computed !== null) {
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
              valIsNull = value === null,
              valIsUndef = value === undefined;
          while (low < high) {
            var mid = floor((low + high) / 2),
                computed = iteratee(array[mid]),
                isDef = computed !== undefined,
                isReflexive = computed === computed;
            if (valIsNaN) {
              var setLow = isReflexive || retHighest;
            } else if (valIsNull) {
              setLow = isReflexive && isDef && (retHighest || computed != null);
            } else if (valIsUndef) {
              setLow = isReflexive && (retHighest || isDef);
            } else if (computed == null) {
              setLow = false;
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
          var offset = argsIndex;
          while (++rightIndex < rightLength) {
            result[offset + rightIndex] = partials[rightIndex];
          }
          while (++holdersIndex < holdersLength) {
            result[offset + holders[holdersIndex]] = args[argsIndex++];
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
                customizer = length > 2 ? sources[length - 2] : undefined,
                guard = length > 2 ? sources[2] : undefined,
                thisArg = length > 1 ? sources[length - 1] : undefined;
            if (typeof customizer == 'function') {
              customizer = bindCallback(customizer, thisArg, 5);
              length -= 2;
            } else {
              customizer = typeof thisArg == 'function' ? thisArg : undefined;
              length -= (customizer ? 1 : 0);
            }
            if (guard && isIterateeCall(sources[0], sources[1], guard)) {
              customizer = length < 3 ? undefined : customizer;
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
            var args = arguments;
            switch (args.length) {
              case 0:
                return new Ctor;
              case 1:
                return new Ctor(args[0]);
              case 2:
                return new Ctor(args[0], args[1]);
              case 3:
                return new Ctor(args[0], args[1], args[2]);
              case 4:
                return new Ctor(args[0], args[1], args[2], args[3]);
              case 5:
                return new Ctor(args[0], args[1], args[2], args[3], args[4]);
            }
            var thisBinding = baseCreate(Ctor.prototype),
                result = Ctor.apply(thisBinding, args);
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
        function createExtremum(comparator, exValue) {
          return function(collection, iteratee, thisArg) {
            if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
              iteratee = null;
            }
            iteratee = getCallback(iteratee, thisArg, 3);
            if (iteratee.length == 1) {
              collection = toIterable(collection);
              var result = arrayExtremum(collection, iteratee, comparator, exValue);
              if (!(collection.length && result === exValue)) {
                return result;
              }
            }
            return baseExtremum(collection, iteratee, comparator, exValue);
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
            var wrapper,
                length = arguments.length,
                index = fromRight ? length : -1,
                leftIndex = 0,
                funcs = Array(length);
            while ((fromRight ? index-- : ++index < length)) {
              var func = funcs[leftIndex++] = arguments[index];
              if (typeof func != 'function') {
                throw new TypeError(FUNC_ERROR_TEXT);
              }
              if (!wrapper && LodashWrapper.prototype.thru && getFuncName(func) == 'wrapper') {
                wrapper = new LodashWrapper([]);
              }
            }
            index = wrapper ? -1 : length;
            while (++index < length) {
              func = funcs[index];
              var funcName = getFuncName(func),
                  data = funcName == 'wrapper' ? getData(func) : null;
              if (data && isLaziable(data[0]) && data[1] == (ARY_FLAG | CURRY_FLAG | PARTIAL_FLAG | REARG_FLAG) && !data[4].length && data[9] == 1) {
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
                  result = length ? funcs[index].apply(this, args) : args[0];
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
        function createObjectMapper(isMapKeys) {
          return function(object, iteratee, thisArg) {
            var result = {};
            iteratee = getCallback(iteratee, thisArg, 3);
            baseForOwn(object, function(value, key, object) {
              var mapped = iteratee(value, key, object);
              key = isMapKeys ? mapped : key;
              value = isMapKeys ? value : mapped;
              result[key] = value;
            });
            return result;
          };
        }
        function createPadDir(fromRight) {
          return function(string, length, chars) {
            string = baseToString(string);
            return (fromRight ? string : '') + createPadding(string, length, chars) + (fromRight ? '' : string);
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
              isCurryRight = bitmask & CURRY_RIGHT_FLAG,
              Ctor = isBindKey ? null : createCtorWrapper(func);
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
            var thisBinding = isBind ? thisArg : this,
                fn = isBindKey ? thisBinding[func] : func;
            if (argPos) {
              args = reorder(args, argPos);
            }
            if (isAry && ary < args.length) {
              args.length = ary;
            }
            if (this && this !== root && this instanceof wrapper) {
              fn = Ctor || createCtorWrapper(func);
            }
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
            var callback = getCallback(iteratee);
            return (iteratee == null && callback === baseCallback) ? binaryIndex(array, value, retHighest) : binaryIndexBy(array, value, callback(iteratee, thisArg, 1), retHighest);
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
              othLength = other.length;
          if (arrLength != othLength && !(isLoose && othLength > arrLength)) {
            return false;
          }
          while (++index < arrLength) {
            var arrValue = array[index],
                othValue = other[index],
                result = customizer ? customizer(isLoose ? othValue : arrValue, isLoose ? arrValue : othValue, index) : undefined;
            if (result !== undefined) {
              if (result) {
                continue;
              }
              return false;
            }
            if (isLoose) {
              if (!arraySome(other, function(othValue) {
                return arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB);
              })) {
                return false;
              }
            } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB))) {
              return false;
            }
          }
          return true;
        }
        function equalByTag(object, other, tag) {
          switch (tag) {
            case boolTag:
            case dateTag:
              return +object == +other;
            case errorTag:
              return object.name == other.name && object.message == other.message;
            case numberTag:
              return (object != +object) ? other != +other : object == +other;
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
          var index = objLength;
          while (index--) {
            var key = objProps[index];
            if (!(isLoose ? key in other : hasOwnProperty.call(other, key))) {
              return false;
            }
          }
          var skipCtor = isLoose;
          while (++index < objLength) {
            key = objProps[index];
            var objValue = object[key],
                othValue = other[key],
                result = customizer ? customizer(isLoose ? othValue : objValue, isLoose ? objValue : othValue, key) : undefined;
            if (!(result === undefined ? equalFunc(objValue, othValue, customizer, isLoose, stackA, stackB) : result)) {
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
        function getCallback(func, thisArg, argCount) {
          var result = lodash.callback || callback;
          result = result === callback ? baseCallback : result;
          return argCount ? result(func, thisArg, argCount) : result;
        }
        var getData = !metaMap ? noop : function(func) {
          return metaMap.get(func);
        };
        function getFuncName(func) {
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
        }
        function getIndexOf(collection, target, fromIndex) {
          var result = lodash.indexOf || indexOf;
          result = result === indexOf ? baseIndexOf : result;
          return collection ? result(collection, target, fromIndex) : result;
        }
        var getLength = baseProperty('length');
        function getMatchData(object) {
          var result = pairs(object),
              length = result.length;
          while (length--) {
            result[length][2] = isStrictComparable(result[length][1]);
          }
          return result;
        }
        function getNative(object, key) {
          var value = object == null ? undefined : object[key];
          return isNative(value) ? value : undefined;
        }
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
        function isArrayLike(value) {
          return value != null && isLength(getLength(value));
        }
        function isIndex(value, length) {
          value = typeof value == 'number' ? value : parseFloat(value);
          length = length == null ? MAX_SAFE_INTEGER : length;
          return value > -1 && value % 1 == 0 && value < length;
        }
        function isIterateeCall(value, index, object) {
          if (!isObject(object)) {
            return false;
          }
          var type = typeof index;
          if (type == 'number' ? (isArrayLike(object) && isIndex(index, object.length)) : (type == 'string' && index in object)) {
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
          return value === value && !isObject(value);
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
              length = propsLength && object.length;
          var allowIndexes = !!length && isLength(length) && (isArray(object) || isArguments(object));
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
          if (!isArrayLike(value)) {
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
          return isArrayLike(array) ? baseDifference(array, baseFlatten(values, false, true)) : [];
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
        var intersection = restParam(function(arrays) {
          var othLength = arrays.length,
              othIndex = othLength,
              caches = Array(length),
              indexOf = getIndexOf(),
              isCommon = indexOf == baseIndexOf,
              result = [];
          while (othIndex--) {
            var value = arrays[othIndex] = isArrayLike(value = arrays[othIndex]) ? value : [];
            caches[othIndex] = (isCommon && value.length >= 120) ? createCache(othIndex && value) : null;
          }
          var array = arrays[0],
              index = -1,
              length = array ? array.length : 0,
              seen = caches[0];
          outer: while (++index < length) {
            value = array[index];
            if ((seen ? cacheIndexOf(seen, value) : indexOf(result, value, 0)) < 0) {
              var othIndex = othLength;
              while (--othIndex) {
                var cache = caches[othIndex];
                if ((cache ? cacheIndexOf(cache, value) : indexOf(arrays[othIndex], value, 0)) < 0) {
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
        });
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
          var callback = getCallback();
          if (!(iteratee == null && callback === baseCallback)) {
            iteratee = callback(iteratee, thisArg, 3);
          }
          return (isSorted && getIndexOf() == baseIndexOf) ? sortedUniq(array, iteratee) : baseUniq(array, iteratee);
        }
        function unzip(array) {
          if (!(array && array.length)) {
            return [];
          }
          var index = -1,
              length = 0;
          array = arrayFilter(array, function(group) {
            if (isArrayLike(group)) {
              length = nativeMax(group.length, length);
              return true;
            }
          });
          var result = Array(length);
          while (++index < length) {
            result[index] = arrayMap(array, baseProperty(index));
          }
          return result;
        }
        function unzipWith(array, iteratee, thisArg) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          var result = unzip(array);
          if (iteratee == null) {
            return result;
          }
          iteratee = bindCallback(iteratee, thisArg, 4);
          return arrayMap(result, function(group) {
            return arrayReduce(group, iteratee, undefined, true);
          });
        }
        var without = restParam(function(array, values) {
          return isArrayLike(array) ? baseDifference(array, values) : [];
        });
        function xor() {
          var index = -1,
              length = arguments.length;
          while (++index < length) {
            var array = arguments[index];
            if (isArrayLike(array)) {
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
        var zipWith = restParam(function(arrays) {
          var length = arrays.length,
              iteratee = length > 2 ? arrays[length - 2] : undefined,
              thisArg = length > 1 ? arrays[length - 1] : undefined;
          if (length > 2 && typeof iteratee == 'function') {
            length -= 2;
          } else {
            iteratee = (length > 1 && typeof thisArg == 'function') ? (--length, thisArg) : undefined;
            thisArg = undefined;
          }
          arrays.length = length;
          return unzipWith(arrays, iteratee, thisArg);
        });
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
              result = isArrayLike(collection) ? Array(collection.length) : [];
          baseEach(collection, function(value) {
            var func = isFunc ? path : ((isProp && value != null) ? value[path] : null);
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
                key = resolver ? resolver.apply(this, args) : args[0],
                cache = memoized.cache;
            if (cache.has(key)) {
              return cache.get(key);
            }
            var result = func.apply(this, args);
            memoized.cache = cache.set(key, result);
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
          return typeof customizer == 'function' ? baseClone(value, isDeep, bindCallback(customizer, thisArg, 1)) : baseClone(value, isDeep);
        }
        function cloneDeep(value, customizer, thisArg) {
          return typeof customizer == 'function' ? baseClone(value, true, bindCallback(customizer, thisArg, 1)) : baseClone(value, true);
        }
        function gt(value, other) {
          return value > other;
        }
        function gte(value, other) {
          return value >= other;
        }
        function isArguments(value) {
          return isObjectLike(value) && isArrayLike(value) && objToString.call(value) == argsTag;
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
          if (isArrayLike(value) && (isArray(value) || isString(value) || isArguments(value) || (isObjectLike(value) && isFunction(value.splice)))) {
            return !value.length;
          }
          return !keys(value).length;
        }
        function isEqual(value, other, customizer, thisArg) {
          customizer = typeof customizer == 'function' ? bindCallback(customizer, thisArg, 3) : undefined;
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
          return !!value && (type == 'object' || type == 'function');
        }
        function isMatch(object, source, customizer, thisArg) {
          customizer = typeof customizer == 'function' ? bindCallback(customizer, thisArg, 3) : undefined;
          return baseIsMatch(object, getMatchData(source), customizer);
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
          var valueOf = getNative(value, 'valueOf'),
              objProto = valueOf && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);
          return objProto ? (value == objProto || getPrototypeOf(value) == objProto) : shimIsPlainObject(value);
        };
        function isRegExp(value) {
          return isObjectLike(value) && objToString.call(value) == regexpTag;
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
        function lt(value, other) {
          return value < other;
        }
        function lte(value, other) {
          return value <= other;
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
            if (object == null) {
              return false;
            }
            path = last(path);
            result = hasOwnProperty.call(object, path);
          }
          return result || (isLength(object.length) && isIndex(path, object.length) && (isArray(object) || isArguments(object)));
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
          var Ctor = object == null ? null : object.constructor;
          if ((typeof Ctor == 'function' && Ctor.prototype === object) || (typeof object != 'function' && isArrayLike(object))) {
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
          length = (length && isLength(length) && (isArray(object) || isArguments(object)) && length) || 0;
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
        var mapKeys = createObjectMapper(true);
        var mapValues = createObjectMapper();
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
          object = toObject(object);
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
                accumulator = baseCreate(isFunction(Ctor) ? Ctor.prototype : null);
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
          return isObjectLike(func) ? matches(func) : baseCallback(func, thisArg);
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
        function matchesProperty(path, srcValue) {
          return baseMatchesProperty(path, baseClone(srcValue, true));
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
                props = isObj ? keys(source) : null,
                methodNames = (props && props.length) ? baseFunctions(source, props) : null;
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
        var max = createExtremum(gt, -Infinity);
        var min = createExtremum(lt, Infinity);
        function sum(collection, iteratee, thisArg) {
          if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
            iteratee = null;
          }
          var callback = getCallback(),
              noIteratee = iteratee == null;
          if (!(noIteratee && callback === baseCallback)) {
            noIteratee = false;
            iteratee = callback(iteratee, thisArg, 3);
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
        lodash.mapKeys = mapKeys;
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
        lodash.unzipWith = unzipWith;
        lodash.values = values;
        lodash.valuesIn = valuesIn;
        lodash.where = where;
        lodash.without = without;
        lodash.wrap = wrap;
        lodash.xor = xor;
        lodash.zip = zip;
        lodash.zipObject = zipObject;
        lodash.zipWith = zipWith;
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
        lodash.gt = gt;
        lodash.gte = gte;
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
        lodash.lt = lt;
        lodash.lte = lte;
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
        lodash.eq = isEqual;
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
          var result = this;
          if (start < 0) {
            result = this.takeRight(-start);
          } else if (start) {
            result = this.drop(start);
          }
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
System.register("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility", ["npm:famous@0.3.5/utilities/Utility"], false, function(__require, __exports, __module) {
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
System.register("github:ijzerenhein/famous-flex@0.3.2/src/LayoutContext", [], false, function(__require, __exports, __module) {
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
System.register("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode", ["npm:famous@0.3.5/core/Transform", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Transform = require("npm:famous@0.3.5/core/Transform");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
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
System.register("github:ijzerenhein/famous-flex@0.3.2/src/helpers/LayoutDockHelper", ["github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
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
System.register("github:ijzerenhein/famous-flex@0.3.2/src/layouts/ListLayout", ["npm:famous@0.3.5/utilities/Utility", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Utility = require("npm:famous@0.3.5/utilities/Utility");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
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
System.register("npm:eventemitter3@1.1.0", ["npm:eventemitter3@1.1.0/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:eventemitter3@1.1.0/index");
  global.define = __define;
  return module.exports;
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

System.register("npm:lodash@3.9.1", ["npm:lodash@3.9.1/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:lodash@3.9.1/index");
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

(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNodeManager", ["github:ijzerenhein/famous-flex@0.3.2/src/LayoutContext", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutContext = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutContext");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
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

(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.2/src/FlowLayoutNode", ["npm:famous@0.3.5/core/OptionsManager", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/math/Vector", "npm:famous@0.3.5/physics/bodies/Particle", "npm:famous@0.3.5/physics/forces/Spring", "npm:famous@0.3.5/physics/PhysicsEngine", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode", "npm:famous@0.3.5/transitions/Transitionable"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
    var Transform = require("npm:famous@0.3.5/core/Transform");
    var Vector = require("npm:famous@0.3.5/math/Vector");
    var Particle = require("npm:famous@0.3.5/physics/bodies/Particle");
    var Spring = require("npm:famous@0.3.5/physics/forces/Spring");
    var PhysicsEngine = require("npm:famous@0.3.5/physics/PhysicsEngine");
    var LayoutNode = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode");
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
System.register("github:ijzerenhein/famous-flex@0.3.2/src/LayoutController", ["npm:famous@0.3.5/utilities/Utility", "npm:famous@0.3.5/core/Entity", "npm:famous@0.3.5/core/ViewSequence", "npm:famous@0.3.5/core/OptionsManager", "npm:famous@0.3.5/core/EventHandler", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutNodeManager", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode", "github:ijzerenhein/famous-flex@0.3.2/src/FlowLayoutNode", "npm:famous@0.3.5/core/Transform", "github:ijzerenhein/famous-flex@0.3.2/src/helpers/LayoutDockHelper"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var Utility = require("npm:famous@0.3.5/utilities/Utility");
    var Entity = require("npm:famous@0.3.5/core/Entity");
    var ViewSequence = require("npm:famous@0.3.5/core/ViewSequence");
    var OptionsManager = require("npm:famous@0.3.5/core/OptionsManager");
    var EventHandler = require("npm:famous@0.3.5/core/EventHandler");
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
    var LayoutNodeManager = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNodeManager");
    var LayoutNode = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode");
    var FlowLayoutNode = require("github:ijzerenhein/famous-flex@0.3.2/src/FlowLayoutNode");
    var Transform = require("npm:famous@0.3.5/core/Transform");
    require("github:ijzerenhein/famous-flex@0.3.2/src/helpers/LayoutDockHelper");
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
(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.2/src/ScrollController", ["github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutController", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode", "github:ijzerenhein/famous-flex@0.3.2/src/FlowLayoutNode", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutNodeManager", "npm:famous@0.3.5/surfaces/ContainerSurface", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/core/EventHandler", "npm:famous@0.3.5/core/Group", "npm:famous@0.3.5/math/Vector", "npm:famous@0.3.5/physics/PhysicsEngine", "npm:famous@0.3.5/physics/bodies/Particle", "npm:famous@0.3.5/physics/forces/Drag", "npm:famous@0.3.5/physics/forces/Spring", "npm:famous@0.3.5/inputs/ScrollSync", "npm:famous@0.3.5/core/ViewSequence"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
    var LayoutController = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutController");
    var LayoutNode = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNode");
    var FlowLayoutNode = require("github:ijzerenhein/famous-flex@0.3.2/src/FlowLayoutNode");
    var LayoutNodeManager = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutNodeManager");
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
    function _isSequentiallyScrollingOptimized() {
      return !this._layout.capabilities || (this._layout.capabilities.sequentialScrollingOptimized === undefined) || this._layout.capabilities.sequentialScrollingOptimized;
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
    function _getEventTimestamp(event) {
      return event.timeStamp || Date.now();
    }
    function _mouseDown(event) {
      if (!this.options.mouseMove) {
        return ;
      }
      if (this._scroll.mouseMove) {
        this.releaseScrollForce(this._scroll.mouseMove.delta);
      }
      var current = [event.clientX, event.clientY];
      var time = _getEventTimestamp(event);
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
        this._scroll.mouseMove.time = _getEventTimestamp(event);
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
      if ((diffTime > 0) && ((_getEventTimestamp(event) - this._scroll.mouseMove.time) <= this.options.touchMoveNoVelocityDuration)) {
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
          var time = _getEventTimestamp(event);
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
              touch.time = _getEventTimestamp(event);
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
      if ((diffTime > 0) && ((_getEventTimestamp(event) - primaryTouch.time) <= this.options.touchMoveNoVelocityDuration)) {
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
      var enforeMinSize = _isSequentiallyScrollingOptimized.call(this);
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
        if (_isSequentiallyScrollingOptimized.call(this)) {
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
      this._eventOutput.emit((this._scroll.scrollForceCount === 1) ? 'swipestart' : 'swipeupdate', {
        target: this,
        total: this._scroll.scrollForce,
        delta: delta
      });
      return this;
    };
    ScrollController.prototype.updateScrollForce = function(prevDelta, newDelta) {
      this.halt();
      newDelta -= prevDelta;
      this._scroll.scrollForce += newDelta;
      this._eventOutput.emit('swipeupdate', {
        target: this,
        total: this._scroll.scrollForce,
        delta: newDelta
      });
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
        this._scroll.scrollForceCount--;
        this._eventOutput.emit('swipeend', {
          target: this,
          total: delta,
          delta: 0,
          velocity: velocity
        });
      } else {
        this._scroll.scrollForce -= delta;
        this._scroll.scrollForceCount--;
        this._eventOutput.emit('swipeupdate', {
          target: this,
          total: this._scroll.scrollForce,
          delta: delta
        });
      }
      return this;
    };
    ScrollController.prototype.getSpec = function(node, normalize) {
      var spec = LayoutController.prototype.getSpec.apply(this, arguments);
      if (spec && _isSequentiallyScrollingOptimized.call(this)) {
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
      var sequentialScrollingOptimized = _isSequentiallyScrollingOptimized.call(this);
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
System.register("npm:lodash@3.9.3/index", ["github:jspm/nodelibs-process@0.1.1"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  (function(process) {
    ;
    (function() {
      var undefined;
      var VERSION = '3.9.3';
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
      var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,
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
      var reIsUint = /^\d+$/;
      var reLatin1 = /[\xc0-\xd6\xd8-\xde\xdf-\xf6\xf8-\xff]/g;
      var reNoMatch = /($^)/;
      var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
      var reWords = (function() {
        var upper = '[A-Z\\xc0-\\xd6\\xd8-\\xde]',
            lower = '[a-z\\xdf-\\xf6\\xf8-\\xff]+';
        return RegExp(upper + '+(?=' + upper + lower + ')|' + upper + '?' + lower + '|' + upper + '+|[0-9]+', 'g');
      }());
      var whitespace = (' \t\x0b\f\xa0\ufeff' + '\n\r\u2028\u2029' + '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000');
      var contextProps = ['Array', 'ArrayBuffer', 'Date', 'Error', 'Float32Array', 'Float64Array', 'Function', 'Int8Array', 'Int16Array', 'Int32Array', 'Math', 'Number', 'Object', 'RegExp', 'Set', 'String', '_', 'clearTimeout', 'document', 'isFinite', 'parseFloat', 'parseInt', 'setTimeout', 'TypeError', 'Uint8Array', 'Uint8ClampedArray', 'Uint16Array', 'Uint32Array', 'WeakMap', 'window'];
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
          var valIsNull = value === null,
              valIsUndef = value === undefined,
              valIsReflexive = value === value;
          var othIsNull = other === null,
              othIsUndef = other === undefined,
              othIsReflexive = other === other;
          if ((value > other && !othIsNull) || !valIsReflexive || (valIsNull && !othIsUndef && othIsReflexive) || (valIsUndef && othIsReflexive)) {
            return 1;
          }
          if ((value < other && !valIsNull) || !othIsReflexive || (othIsNull && !valIsUndef && valIsReflexive) || (othIsUndef && valIsReflexive)) {
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
        var document = (document = context.window) ? document.document : null;
        var fnToString = Function.prototype.toString;
        var hasOwnProperty = objectProto.hasOwnProperty;
        var idCounter = 0;
        var objToString = objectProto.toString;
        var oldDash = context._;
        var reIsNative = RegExp('^' + escapeRegExp(fnToString.call(hasOwnProperty)).replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
        var ArrayBuffer = getNative(context, 'ArrayBuffer'),
            bufferSlice = getNative(ArrayBuffer && new ArrayBuffer(0), 'slice'),
            ceil = Math.ceil,
            clearTimeout = context.clearTimeout,
            floor = Math.floor,
            getPrototypeOf = getNative(Object, 'getPrototypeOf'),
            parseFloat = context.parseFloat,
            push = arrayProto.push,
            Set = getNative(context, 'Set'),
            setTimeout = context.setTimeout,
            splice = arrayProto.splice,
            Uint8Array = getNative(context, 'Uint8Array'),
            WeakMap = getNative(context, 'WeakMap');
        var Float64Array = (function() {
          try {
            var func = getNative(context, 'Float64Array'),
                result = new func(new ArrayBuffer(10), 0, 1) && func;
          } catch (e) {}
          return result || null;
        }());
        var nativeCreate = getNative(Object, 'create'),
            nativeIsArray = getNative(Array, 'isArray'),
            nativeIsFinite = context.isFinite,
            nativeKeys = getNative(Object, 'keys'),
            nativeMax = Math.max,
            nativeMin = Math.min,
            nativeNow = getNative(Date, 'now'),
            nativeNumIsFinite = getNative(Number, 'isFinite'),
            nativeParseInt = context.parseInt,
            nativeRandom = Math.random;
        var NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY,
            POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
        var MAX_ARRAY_LENGTH = 4294967295,
            MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1,
            HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
        var FLOAT64_BYTES_PER_ELEMENT = Float64Array ? Float64Array.BYTES_PER_ELEMENT : 0;
        var MAX_SAFE_INTEGER = 9007199254740991;
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
          try {
            support.dom = document.createDocumentFragment().nodeType === 11;
          } catch (e) {
            support.dom = false;
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
        function arrayExtremum(array, iteratee, comparator, exValue) {
          var index = -1,
              length = array.length,
              computed = exValue,
              result = computed;
          while (++index < length) {
            var value = array[index],
                current = +iteratee(value);
            if (comparator(current, computed)) {
              computed = current;
              result = value;
            }
          }
          return result;
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
          var index = -1,
              props = keys(source),
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
        function baseAssign(object, source) {
          return source == null ? object : baseCopy(source, keys(source), object);
        }
        function baseAt(collection, props) {
          var index = -1,
              isNil = collection == null,
              isArr = !isNil && isArrayLike(collection),
              length = isArr ? collection.length : 0,
              propsLength = props.length,
              result = Array(propsLength);
          while (++index < propsLength) {
            var key = props[index];
            if (isArr) {
              result[index] = isIndex(key, length) ? collection[key] : undefined;
            } else {
              result[index] = isNil ? undefined : collection[key];
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
          function object() {}
          return function(prototype) {
            if (isObject(prototype)) {
              object.prototype = prototype;
              var result = new object;
              object.prototype = null;
            }
            return result || {};
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
        function baseExtremum(collection, iteratee, comparator, exValue) {
          var computed = exValue,
              result = computed;
          baseEach(collection, function(value, index, collection) {
            var current = +iteratee(value, index, collection);
            if (comparator(current, computed) || (current === exValue && current === result)) {
              computed = current;
              result = value;
            }
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
            if (isObjectLike(value) && isArrayLike(value) && (isStrict || isArray(value) || isArguments(value))) {
              if (isDeep) {
                value = baseFlatten(value, isDeep, isStrict);
              }
              var valIndex = -1,
                  valLength = value.length;
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
          var index = 0,
              length = path.length;
          while (object != null && index < length) {
            object = object[path[index++]];
          }
          return (index && index == length) ? object : undefined;
        }
        function baseIsEqual(value, other, customizer, isLoose, stackA, stackB) {
          if (value === other) {
            return true;
          }
          if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
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
            var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
                othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');
            if (objIsWrapped || othIsWrapped) {
              return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, isLoose, stackA, stackB);
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
        function baseIsMatch(object, matchData, customizer) {
          var index = matchData.length,
              length = index,
              noCustomizer = !customizer;
          if (object == null) {
            return !length;
          }
          object = toObject(object);
          while (index--) {
            var data = matchData[index];
            if ((noCustomizer && data[2]) ? data[1] !== object[data[0]] : !(data[0] in object)) {
              return false;
            }
          }
          while (++index < length) {
            data = matchData[index];
            var key = data[0],
                objValue = object[key],
                srcValue = data[1];
            if (noCustomizer && data[2]) {
              if (objValue === undefined && !(key in object)) {
                return false;
              }
            } else {
              var result = customizer ? customizer(objValue, srcValue, key) : undefined;
              if (!(result === undefined ? baseIsEqual(srcValue, objValue, customizer, true) : result)) {
                return false;
              }
            }
          }
          return true;
        }
        function baseMap(collection, iteratee) {
          var index = -1,
              result = isArrayLike(collection) ? Array(collection.length) : [];
          baseEach(collection, function(value, key, collection) {
            result[++index] = iteratee(value, key, collection);
          });
          return result;
        }
        function baseMatches(source) {
          var matchData = getMatchData(source);
          if (matchData.length == 1 && matchData[0][2]) {
            var key = matchData[0][0],
                value = matchData[0][1];
            return function(object) {
              if (object == null) {
                return false;
              }
              return object[key] === value && (value !== undefined || (key in toObject(object)));
            };
          }
          return function(object) {
            return baseIsMatch(object, matchData);
          };
        }
        function baseMatchesProperty(path, srcValue) {
          var isArr = isArray(path),
              isCommon = isKey(path) && isStrictComparable(srcValue),
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
            return object[key] === srcValue ? (srcValue !== undefined || (key in object)) : baseIsEqual(srcValue, object[key], undefined, true);
          };
        }
        function baseMerge(object, source, customizer, stackA, stackB) {
          if (!isObject(object)) {
            return object;
          }
          var isSrcArr = isArrayLike(source) && (isArray(source) || isTypedArray(source)),
              props = isSrcArr ? null : keys(source);
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
              if ((result !== undefined || (isSrcArr && !(key in object))) && (isCommon || (result === result ? (result !== value) : (value === value)))) {
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
            if (isArrayLike(srcValue) && (isArray(srcValue) || isTypedArray(srcValue))) {
              result = isArray(value) ? value : (isArrayLike(value) ? arrayCopy(value) : []);
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
          var length = array ? indexes.length : 0;
          while (length--) {
            var index = indexes[length];
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
              if ((retHighest ? (computed <= value) : (computed < value)) && computed !== null) {
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
              valIsNull = value === null,
              valIsUndef = value === undefined;
          while (low < high) {
            var mid = floor((low + high) / 2),
                computed = iteratee(array[mid]),
                isDef = computed !== undefined,
                isReflexive = computed === computed;
            if (valIsNaN) {
              var setLow = isReflexive || retHighest;
            } else if (valIsNull) {
              setLow = isReflexive && isDef && (retHighest || computed != null);
            } else if (valIsUndef) {
              setLow = isReflexive && (retHighest || isDef);
            } else if (computed == null) {
              setLow = false;
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
          var offset = argsIndex;
          while (++rightIndex < rightLength) {
            result[offset + rightIndex] = partials[rightIndex];
          }
          while (++holdersIndex < holdersLength) {
            result[offset + holders[holdersIndex]] = args[argsIndex++];
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
                customizer = length > 2 ? sources[length - 2] : undefined,
                guard = length > 2 ? sources[2] : undefined,
                thisArg = length > 1 ? sources[length - 1] : undefined;
            if (typeof customizer == 'function') {
              customizer = bindCallback(customizer, thisArg, 5);
              length -= 2;
            } else {
              customizer = typeof thisArg == 'function' ? thisArg : undefined;
              length -= (customizer ? 1 : 0);
            }
            if (guard && isIterateeCall(sources[0], sources[1], guard)) {
              customizer = length < 3 ? undefined : customizer;
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
            var args = arguments;
            switch (args.length) {
              case 0:
                return new Ctor;
              case 1:
                return new Ctor(args[0]);
              case 2:
                return new Ctor(args[0], args[1]);
              case 3:
                return new Ctor(args[0], args[1], args[2]);
              case 4:
                return new Ctor(args[0], args[1], args[2], args[3]);
              case 5:
                return new Ctor(args[0], args[1], args[2], args[3], args[4]);
            }
            var thisBinding = baseCreate(Ctor.prototype),
                result = Ctor.apply(thisBinding, args);
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
        function createExtremum(comparator, exValue) {
          return function(collection, iteratee, thisArg) {
            if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
              iteratee = null;
            }
            iteratee = getCallback(iteratee, thisArg, 3);
            if (iteratee.length == 1) {
              collection = toIterable(collection);
              var result = arrayExtremum(collection, iteratee, comparator, exValue);
              if (!(collection.length && result === exValue)) {
                return result;
              }
            }
            return baseExtremum(collection, iteratee, comparator, exValue);
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
            var wrapper,
                length = arguments.length,
                index = fromRight ? length : -1,
                leftIndex = 0,
                funcs = Array(length);
            while ((fromRight ? index-- : ++index < length)) {
              var func = funcs[leftIndex++] = arguments[index];
              if (typeof func != 'function') {
                throw new TypeError(FUNC_ERROR_TEXT);
              }
              if (!wrapper && LodashWrapper.prototype.thru && getFuncName(func) == 'wrapper') {
                wrapper = new LodashWrapper([]);
              }
            }
            index = wrapper ? -1 : length;
            while (++index < length) {
              func = funcs[index];
              var funcName = getFuncName(func),
                  data = funcName == 'wrapper' ? getData(func) : null;
              if (data && isLaziable(data[0]) && data[1] == (ARY_FLAG | CURRY_FLAG | PARTIAL_FLAG | REARG_FLAG) && !data[4].length && data[9] == 1) {
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
                  result = length ? funcs[index].apply(this, args) : args[0];
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
        function createObjectMapper(isMapKeys) {
          return function(object, iteratee, thisArg) {
            var result = {};
            iteratee = getCallback(iteratee, thisArg, 3);
            baseForOwn(object, function(value, key, object) {
              var mapped = iteratee(value, key, object);
              key = isMapKeys ? mapped : key;
              value = isMapKeys ? value : mapped;
              result[key] = value;
            });
            return result;
          };
        }
        function createPadDir(fromRight) {
          return function(string, length, chars) {
            string = baseToString(string);
            return (fromRight ? string : '') + createPadding(string, length, chars) + (fromRight ? '' : string);
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
              isCurryRight = bitmask & CURRY_RIGHT_FLAG,
              Ctor = isBindKey ? null : createCtorWrapper(func);
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
            var thisBinding = isBind ? thisArg : this,
                fn = isBindKey ? thisBinding[func] : func;
            if (argPos) {
              args = reorder(args, argPos);
            }
            if (isAry && ary < args.length) {
              args.length = ary;
            }
            if (this && this !== root && this instanceof wrapper) {
              fn = Ctor || createCtorWrapper(func);
            }
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
            var callback = getCallback(iteratee);
            return (iteratee == null && callback === baseCallback) ? binaryIndex(array, value, retHighest) : binaryIndexBy(array, value, callback(iteratee, thisArg, 1), retHighest);
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
              othLength = other.length;
          if (arrLength != othLength && !(isLoose && othLength > arrLength)) {
            return false;
          }
          while (++index < arrLength) {
            var arrValue = array[index],
                othValue = other[index],
                result = customizer ? customizer(isLoose ? othValue : arrValue, isLoose ? arrValue : othValue, index) : undefined;
            if (result !== undefined) {
              if (result) {
                continue;
              }
              return false;
            }
            if (isLoose) {
              if (!arraySome(other, function(othValue) {
                return arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB);
              })) {
                return false;
              }
            } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB))) {
              return false;
            }
          }
          return true;
        }
        function equalByTag(object, other, tag) {
          switch (tag) {
            case boolTag:
            case dateTag:
              return +object == +other;
            case errorTag:
              return object.name == other.name && object.message == other.message;
            case numberTag:
              return (object != +object) ? other != +other : object == +other;
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
          var index = objLength;
          while (index--) {
            var key = objProps[index];
            if (!(isLoose ? key in other : hasOwnProperty.call(other, key))) {
              return false;
            }
          }
          var skipCtor = isLoose;
          while (++index < objLength) {
            key = objProps[index];
            var objValue = object[key],
                othValue = other[key],
                result = customizer ? customizer(isLoose ? othValue : objValue, isLoose ? objValue : othValue, key) : undefined;
            if (!(result === undefined ? equalFunc(objValue, othValue, customizer, isLoose, stackA, stackB) : result)) {
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
        function getCallback(func, thisArg, argCount) {
          var result = lodash.callback || callback;
          result = result === callback ? baseCallback : result;
          return argCount ? result(func, thisArg, argCount) : result;
        }
        var getData = !metaMap ? noop : function(func) {
          return metaMap.get(func);
        };
        function getFuncName(func) {
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
        }
        function getIndexOf(collection, target, fromIndex) {
          var result = lodash.indexOf || indexOf;
          result = result === indexOf ? baseIndexOf : result;
          return collection ? result(collection, target, fromIndex) : result;
        }
        var getLength = baseProperty('length');
        function getMatchData(object) {
          var result = pairs(object),
              length = result.length;
          while (length--) {
            result[length][2] = isStrictComparable(result[length][1]);
          }
          return result;
        }
        function getNative(object, key) {
          var value = object == null ? undefined : object[key];
          return isNative(value) ? value : undefined;
        }
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
        function isArrayLike(value) {
          return value != null && isLength(getLength(value));
        }
        function isIndex(value, length) {
          value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
          length = length == null ? MAX_SAFE_INTEGER : length;
          return value > -1 && value % 1 == 0 && value < length;
        }
        function isIterateeCall(value, index, object) {
          if (!isObject(object)) {
            return false;
          }
          var type = typeof index;
          if (type == 'number' ? (isArrayLike(object) && isIndex(index, object.length)) : (type == 'string' && index in object)) {
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
          if (!(funcName in LazyWrapper.prototype)) {
            return false;
          }
          var other = lodash[funcName];
          if (func === other) {
            return true;
          }
          var data = getData(other);
          return !!data && func === data[0];
        }
        function isLength(value) {
          return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
        }
        function isStrictComparable(value) {
          return value === value && !isObject(value);
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
              length = propsLength && object.length;
          var allowIndexes = !!length && isLength(length) && (isArray(object) || isArguments(object));
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
          if (!isArrayLike(value)) {
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
          return isArrayLike(array) ? baseDifference(array, baseFlatten(values, false, true)) : [];
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
        var intersection = restParam(function(arrays) {
          var othLength = arrays.length,
              othIndex = othLength,
              caches = Array(length),
              indexOf = getIndexOf(),
              isCommon = indexOf == baseIndexOf,
              result = [];
          while (othIndex--) {
            var value = arrays[othIndex] = isArrayLike(value = arrays[othIndex]) ? value : [];
            caches[othIndex] = (isCommon && value.length >= 120) ? createCache(othIndex && value) : null;
          }
          var array = arrays[0],
              index = -1,
              length = array ? array.length : 0,
              seen = caches[0];
          outer: while (++index < length) {
            value = array[index];
            if ((seen ? cacheIndexOf(seen, value) : indexOf(result, value, 0)) < 0) {
              var othIndex = othLength;
              while (--othIndex) {
                var cache = caches[othIndex];
                if ((cache ? cacheIndexOf(cache, value) : indexOf(arrays[othIndex], value, 0)) < 0) {
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
        });
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
          var callback = getCallback();
          if (!(iteratee == null && callback === baseCallback)) {
            iteratee = callback(iteratee, thisArg, 3);
          }
          return (isSorted && getIndexOf() == baseIndexOf) ? sortedUniq(array, iteratee) : baseUniq(array, iteratee);
        }
        function unzip(array) {
          if (!(array && array.length)) {
            return [];
          }
          var index = -1,
              length = 0;
          array = arrayFilter(array, function(group) {
            if (isArrayLike(group)) {
              length = nativeMax(group.length, length);
              return true;
            }
          });
          var result = Array(length);
          while (++index < length) {
            result[index] = arrayMap(array, baseProperty(index));
          }
          return result;
        }
        function unzipWith(array, iteratee, thisArg) {
          var length = array ? array.length : 0;
          if (!length) {
            return [];
          }
          var result = unzip(array);
          if (iteratee == null) {
            return result;
          }
          iteratee = bindCallback(iteratee, thisArg, 4);
          return arrayMap(result, function(group) {
            return arrayReduce(group, iteratee, undefined, true);
          });
        }
        var without = restParam(function(array, values) {
          return isArrayLike(array) ? baseDifference(array, values) : [];
        });
        function xor() {
          var index = -1,
              length = arguments.length;
          while (++index < length) {
            var array = arguments[index];
            if (isArrayLike(array)) {
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
        var zipWith = restParam(function(arrays) {
          var length = arrays.length,
              iteratee = length > 2 ? arrays[length - 2] : undefined,
              thisArg = length > 1 ? arrays[length - 1] : undefined;
          if (length > 2 && typeof iteratee == 'function') {
            length -= 2;
          } else {
            iteratee = (length > 1 && typeof thisArg == 'function') ? (--length, thisArg) : undefined;
            thisArg = undefined;
          }
          arrays.length = length;
          return unzipWith(arrays, iteratee, thisArg);
        });
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
              result = isArrayLike(collection) ? Array(collection.length) : [];
          baseEach(collection, function(value) {
            var func = isFunc ? path : ((isProp && value != null) ? value[path] : null);
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
          var index = -1,
              result = toArray(collection),
              length = result.length,
              lastIndex = length - 1;
          n = nativeMin(n < 0 ? 0 : (+n || 0), length);
          while (++index < n) {
            var rand = baseRandom(index, lastIndex),
                value = result[rand];
            result[rand] = result[index];
            result[index] = value;
          }
          result.length = n;
          return result;
        }
        function shuffle(collection) {
          return sample(collection, POSITIVE_INFINITY);
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
                key = resolver ? resolver.apply(this, args) : args[0],
                cache = memoized.cache;
            if (cache.has(key)) {
              return cache.get(key);
            }
            var result = func.apply(this, args);
            memoized.cache = cache.set(key, result);
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
          return typeof customizer == 'function' ? baseClone(value, isDeep, bindCallback(customizer, thisArg, 1)) : baseClone(value, isDeep);
        }
        function cloneDeep(value, customizer, thisArg) {
          return typeof customizer == 'function' ? baseClone(value, true, bindCallback(customizer, thisArg, 1)) : baseClone(value, true);
        }
        function gt(value, other) {
          return value > other;
        }
        function gte(value, other) {
          return value >= other;
        }
        function isArguments(value) {
          return isObjectLike(value) && isArrayLike(value) && objToString.call(value) == argsTag;
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
          if (isArrayLike(value) && (isArray(value) || isString(value) || isArguments(value) || (isObjectLike(value) && isFunction(value.splice)))) {
            return !value.length;
          }
          return !keys(value).length;
        }
        function isEqual(value, other, customizer, thisArg) {
          customizer = typeof customizer == 'function' ? bindCallback(customizer, thisArg, 3) : undefined;
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
          return !!value && (type == 'object' || type == 'function');
        }
        function isMatch(object, source, customizer, thisArg) {
          customizer = typeof customizer == 'function' ? bindCallback(customizer, thisArg, 3) : undefined;
          return baseIsMatch(object, getMatchData(source), customizer);
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
          var valueOf = getNative(value, 'valueOf'),
              objProto = valueOf && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);
          return objProto ? (value == objProto || getPrototypeOf(value) == objProto) : shimIsPlainObject(value);
        };
        function isRegExp(value) {
          return isObjectLike(value) && objToString.call(value) == regexpTag;
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
        function lt(value, other) {
          return value < other;
        }
        function lte(value, other) {
          return value <= other;
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
            if (object == null) {
              return false;
            }
            path = last(path);
            result = hasOwnProperty.call(object, path);
          }
          return result || (isLength(object.length) && isIndex(path, object.length) && (isArray(object) || isArguments(object)));
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
          var Ctor = object == null ? null : object.constructor;
          if ((typeof Ctor == 'function' && Ctor.prototype === object) || (typeof object != 'function' && isArrayLike(object))) {
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
          length = (length && isLength(length) && (isArray(object) || isArguments(object)) && length) || 0;
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
        var mapKeys = createObjectMapper(true);
        var mapValues = createObjectMapper();
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
          object = toObject(object);
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
              lastIndex = length - 1,
              nested = object;
          while (nested != null && ++index < length) {
            var key = path[index];
            if (isObject(nested)) {
              if (index == lastIndex) {
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
                accumulator = baseCreate(isFunction(Ctor) ? Ctor.prototype : null);
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
          return isObjectLike(func) ? matches(func) : baseCallback(func, thisArg);
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
        function matchesProperty(path, srcValue) {
          return baseMatchesProperty(path, baseClone(srcValue, true));
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
                props = isObj ? keys(source) : null,
                methodNames = (props && props.length) ? baseFunctions(source, props) : null;
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
        var max = createExtremum(gt, NEGATIVE_INFINITY);
        var min = createExtremum(lt, POSITIVE_INFINITY);
        function sum(collection, iteratee, thisArg) {
          if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
            iteratee = null;
          }
          var callback = getCallback(),
              noIteratee = iteratee == null;
          if (!(noIteratee && callback === baseCallback)) {
            noIteratee = false;
            iteratee = callback(iteratee, thisArg, 3);
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
        lodash.mapKeys = mapKeys;
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
        lodash.unzipWith = unzipWith;
        lodash.values = values;
        lodash.valuesIn = valuesIn;
        lodash.where = where;
        lodash.without = without;
        lodash.wrap = wrap;
        lodash.xor = xor;
        lodash.zip = zip;
        lodash.zipObject = zipObject;
        lodash.zipWith = zipWith;
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
        lodash.gt = gt;
        lodash.gte = gte;
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
        lodash.lt = lt;
        lodash.lte = lte;
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
        lodash.eq = isEqual;
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
          var result = this;
          if (start < 0) {
            result = this.takeRight(-start);
          } else if (start) {
            result = this.drop(start);
          }
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

(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.2/src/AnimationController", ["npm:famous@0.3.5/core/View", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutController", "npm:famous@0.3.5/core/Transform", "npm:famous@0.3.5/core/Modifier", "npm:famous@0.3.5/modifiers/StateModifier", "npm:famous@0.3.5/core/RenderNode", "npm:famous@0.3.5/utilities/Timer", "npm:famous@0.3.5/transitions/Easing"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var View = require("npm:famous@0.3.5/core/View");
    var LayoutController = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutController");
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
      Fade: function(show, size) {
        return {opacity: (this && (this.opacity !== undefined)) ? this.opacity : 0};
      },
      Zoom: function(show, size) {
        var scale = (this && (this.scale !== undefined)) ? this.scale : 0.5;
        return {
          transform: Transform.scale(scale, scale, 1),
          align: [0.5, 0.5],
          origin: [0.5, 0.5]
        };
      },
      FadedZoom: function(show, size) {
        var scale = show ? ((this && (this.showScale !== undefined)) ? this.showScale : 0.9) : ((this && (this.hideScale !== undefined)) ? this.hideScale : 1.1);
        return {
          opacity: (this && (this.opacity !== undefined)) ? this.opacity : 0,
          transform: Transform.scale(scale, scale, 1),
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
      transfer: {
        fastResize: true,
        zIndex: 10
      },
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
              if ((sourceSpec.opacity !== undefined) || (targetSpec.opacity !== undefined)) {
                mod.setOpacity((targetSpec.opacity === undefined) ? 1 : targetSpec.opacity, transition || item.options.transfer.transition);
              }
              if (item.options.transfer.fastResize) {
                if (sourceSpec.transform || targetSpec.transform || sourceSpec.size || targetSpec.size) {
                  var transform = targetSpec.transform || Transform.identity;
                  if (sourceSpec.size && targetSpec.size) {
                    transform = Transform.multiply(transform, Transform.scale(targetSpec.size[0] / sourceSpec.size[0], targetSpec.size[1] / sourceSpec.size[1], 1));
                  }
                  mod.setTransform(transform, transition || item.options.transfer.transition);
                }
              } else {
                if (sourceSpec.transform || targetSpec.transform) {
                  mod.setTransform(targetSpec.transform || Transform.identity, transition || item.options.transfer.transition);
                }
                if (sourceSpec.size || targetSpec.size) {
                  mod.setSize(targetSpec.size || sourceSpec.size, transition || item.options.transfer.transition);
                }
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
      var spec = animation ? animation.call(undefined, show, size) : {};
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
    function _setItemOptions(item, options) {
      item.options = {
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
          zIndex: this.options.transfer.zIndex,
          fastResize: this.options.transfer.fastResize
        }
      };
      if (options) {
        item.options.show.transition = (options.show ? options.show.transition : undefined) || options.transition || item.options.show.transition;
        if (options && options.show && (options.show.animation !== undefined)) {
          item.options.show.animation = options.show.animation;
        } else if (options && (options.animation !== undefined)) {
          item.options.show.animation = options.animation;
        }
        item.options.transfer.transition = (options.transfer ? options.transfer.transition : undefined) || options.transition || item.options.transfer.transition;
        item.options.transfer.items = (options.transfer ? options.transfer.items : undefined) || item.options.transfer.items;
        item.options.transfer.zIndex = (options.transfer && (options.transfer.zIndex !== undefined)) ? options.transfer.zIndex : item.options.transfer.zIndex;
        item.options.transfer.fastResize = (options.transfer && (options.transfer.fastResize !== undefined)) ? options.transfer.fastResize : item.options.transfer.fastResize;
      }
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
        if (item.state === ItemState.HIDE) {
          item.state = ItemState.QUEUED;
          _setItemOptions.call(this, item, options);
          _updateState.call(this);
        }
        return this;
      }
      if (item && (item.state !== ItemState.HIDING) && options) {
        item.options.hide.transition = (options.hide ? options.hide.transition : undefined) || options.transition || item.options.hide.transition;
        if (options && options.hide && (options.hide.animation !== undefined)) {
          item.options.hide.animation = options.hide.animation;
        } else if (options && (options.animation !== undefined)) {
          item.options.hide.animation = options.animation;
        }
      }
      item = {
        view: renderable,
        mod: new StateModifier(),
        state: ItemState.QUEUED,
        callback: callback,
        transferables: []
      };
      item.node = new RenderNode(item.mod);
      item.node.add(renderable);
      _setItemOptions.call(this, item, options);
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
        this.layout.reflowLayout();
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
        if (options && options.hide && (options.hide.animation !== undefined)) {
          item.options.hide.animation = options.hide.animation;
        } else if (options && (options.animation !== undefined)) {
          item.options.hide.animation = options.animation;
        }
      }
      item.hideCallback = function() {
        var index = this._viewStack.indexOf(item);
        this._renderables.views.splice(index, 1);
        this._viewStack.splice(index, 1);
        item.view = undefined;
        _updateState.call(this);
        this.layout.reflowLayout();
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
(function() {
function define(){};  define.amd = {};
System.register("github:ijzerenhein/famous-flex@0.3.2/src/FlexScrollView", ["github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility", "github:ijzerenhein/famous-flex@0.3.2/src/ScrollController", "github:ijzerenhein/famous-flex@0.3.2/src/layouts/ListLayout"], false, function(__require, __exports, __module) {
  return (function(require, exports, module) {
    var LayoutUtility = require("github:ijzerenhein/famous-flex@0.3.2/src/LayoutUtility");
    var ScrollController = require("github:ijzerenhein/famous-flex@0.3.2/src/ScrollController");
    var ListLayout = require("github:ijzerenhein/famous-flex@0.3.2/src/layouts/ListLayout");
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
System.register("npm:lodash@3.9.3", ["npm:lodash@3.9.3/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:lodash@3.9.3/index");
  global.define = __define;
  return module.exports;
});

System.register("github:Bizboard/di.js@master/util", [], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master/util";
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

System.register("github:Bizboard/di.js@master/profiler", ["github:Bizboard/di.js@master/util"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master/profiler";
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

System.register("github:Bizboard/di.js@master/providers", ["github:Bizboard/di.js@master/annotations", "github:Bizboard/di.js@master/util"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master/providers";
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
        function ClassProvider(clazz, params, isPromise) {
          this.provider = clazz;
          this.isPromise = isPromise;
          this.params = [];
          this._constructors = [];
          this._flattenParams(clazz, params);
          this._constructors.unshift([clazz, 0, this.params.length - 1]);
        }
        return ($traceurRuntime.createClass)(ClassProvider, {
          _flattenParams: function(constructor, params) {
            var SuperConstructor;
            var constructorInfo;
            var $__4 = true;
            var $__5 = false;
            var $__6 = undefined;
            try {
              for (var $__2 = void 0,
                  $__1 = (params)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__4 = ($__2 = $__1.next()).done); $__4 = true) {
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
            } catch ($__7) {
              $__5 = true;
              $__6 = $__7;
            } finally {
              try {
                if (!$__4 && $__1.return != null) {
                  $__1.return();
                }
              } finally {
                if ($__5) {
                  throw $__6;
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
        function FactoryProvider(factoryFunction, params, isPromise) {
          this.provider = factoryFunction;
          this.params = params;
          this.isPromise = isPromise;
          var $__4 = true;
          var $__5 = false;
          var $__6 = undefined;
          try {
            for (var $__2 = void 0,
                $__1 = (params)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__4 = ($__2 = $__1.next()).done); $__4 = true) {
              var param = $__2.value;
              {
                if (param.token === SuperConstructorAnnotation) {
                  throw new Error((toString(factoryFunction) + " is not a class. Only classes with a parent can ask for SuperConstructor!"));
                }
              }
            }
          } catch ($__7) {
            $__5 = true;
            $__6 = $__7;
          } finally {
            try {
              if (!$__4 && $__1.return != null) {
                $__1.return();
              }
            } finally {
              if ($__5) {
                throw $__6;
              }
            }
          }
        }
        return ($traceurRuntime.createClass)(FactoryProvider, {create: function(args) {
            return this.provider.apply(undefined, args);
          }}, {});
      }());
    }
  };
});

System.register("routers/ArvaRouter", ["npm:lodash@3.9.1", "github:Bizboard/di.js@master", "npm:famous@0.3.5/transitions/Easing", "github:ijzerenhein/famous-flex@0.3.2/src/AnimationController", "core/Router"], function($__export) {
  "use strict";
  var __moduleName = "routers/ArvaRouter";
  var _,
      Provide,
      Easing,
      AnimationController,
      Router,
      ArvaRouter;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }, function($__m) {
      Provide = $__m.Provide;
    }, function($__m) {
      Easing = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }, function($__m) {
      Router = $__m.Router;
    }],
    execute: function() {
      ArvaRouter = (function($__super) {
        function ArvaRouter() {
          $traceurRuntime.superConstructor(ArvaRouter).call(this);
          if (window == null) {
            return ;
          }
          this.routes = {};
          this.history = [];
          this.decode = decodeURIComponent;
          window.addEventListener('hashchange', this.run);
        }
        return ($traceurRuntime.createClass)(ArvaRouter, {
          setDefault: function(controller) {
            var method = arguments[1] !== (void 0) ? arguments[1] : null;
            this.defaultController = this._getControllerName(controller);
            if (method != null) {
              this.defaultMethod = method;
            }
          },
          setControllerSpecs: function(specs) {
            this.specs = specs;
          },
          go: function(controller, method) {
            var params = arguments[2] !== (void 0) ? arguments[2] : null;
            var controllerName = this._getControllerName(controller);
            var routeRoot = controllerName.replace(this.defaultController, '').replace('Controller', '');
            var hash = '#' + (routeRoot.length > 0 ? '/' + routeRoot : '') + ('/' + method);
            if (params !== null) {
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
                  name = piece[0] === ':' ? ':' : piece;
              rules = rules[name] || (rules[name] = {});
              if (name === ':') {
                rules['@name'] = piece.slice(1);
              }
            }
            rules['@'] = handler;
          },
          run: function() {
            var url = window.location.hash.replace('#', '');
            if (url !== '') {
              url = url.replace('/?', '?');
              url[0] === '/' && (url = url.slice(1));
              url.slice(-1) === '/' && (url = url.slice(0, -1));
            }
            var rules = this.routes,
                querySplit = url.split('?'),
                pieces = querySplit[0].split('/'),
                values = [],
                keys = [],
                method = '';
            var rule = null;
            var controller = null;
            if (pieces.length === 1 && pieces[0].length === 0) {
              pieces[0] = this.defaultController;
              pieces.push(this.defaultMethod);
            } else if (pieces.length === 1 && pieces[0].length > 0) {
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
              this._executeRoute(rule, currentRoute);
              return true;
            } else {
              console.log('Controller doesn\'t exist!');
            }
            return false;
          },
          _executeRoute: function(rule, route) {
            rule['@'](route);
            this.emit('routechange', route);
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
            console.log('No spec defined from ' + fromController + ' to ' + toController + '. Please check router.setControllerSpecs() in your app constructor.');
          },
          _getControllerName: function(controller) {
            if (typeof controller === "string") {
              return controller.replace('Controller', '');
            } else if (typeof controller === "function" && Object.getPrototypeOf(controller).constructor.name == "Function") {
              return controller.name.replace('Controller', '');
            } else {
              return typeof controller === "object" ? Object.getPrototypeOf(controller).constructor.name.replace('Controller', '') : typeof controller;
            }
          }
        }, {}, $__super);
      }(Router));
      $__export("ArvaRouter", ArvaRouter);
      Object.defineProperty(ArvaRouter, "annotations", {get: function() {
          return [new Provide(Router)];
        }});
    }
  };
});

System.register("views/View", ["npm:lodash@3.9.1", "npm:famous@0.3.5/core/View", "github:ijzerenhein/famous-flex@0.3.2/src/LayoutController", "github:Bizboard/arva-utils@master/ObjectHelper"], function($__export) {
  "use strict";
  var __moduleName = "views/View";
  var _,
      FamousView,
      LayoutController,
      ObjectHelper,
      DEFAULT_OPTIONS,
      View;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }, function($__m) {
      FamousView = $__m.default;
    }, function($__m) {
      LayoutController = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.ObjectHelper;
    }],
    execute: function() {
      DEFAULT_OPTIONS = {};
      View = (function($__super) {
        function View() {
          var options = arguments[0] !== (void 0) ? arguments[0] : {};
          $traceurRuntime.superConstructor(View).call(this, _.merge(options, DEFAULT_OPTIONS));
          this.renderables = {};
          this.layouts = [];
          ObjectHelper.bindAllMethods(this, this);
        }
        return ($traceurRuntime.createClass)(View, {
          build: function() {
            this._combineLayouts();
          },
          _combineLayouts: function() {
            this.layout = new LayoutController({
              autoPipeEvents: true,
              layout: function(context) {
                var isPortrait = window.matchMedia('(orientation: portrait)').matches;
                if (this.layouts && this.layouts.length > 0) {
                  var layouts = this.layouts.length;
                  for (var l = 0; l < layouts; l++) {
                    var spec = this.layouts[l];
                    var specType = typeof spec;
                    if (specType === 'object') {
                      if (isPortrait) {
                        if (spec.portrait) {
                          spec.portrait.call(this, context);
                        } else {
                          console.log('no portrait layout for view defined.');
                        }
                      } else {
                        if (spec.landscape) {
                          spec.landscape.call(this, context);
                        } else {
                          console.log('no landscape layout for view defined.');
                        }
                      }
                    } else if (specType === 'function') {
                      spec.call(this, context);
                    } else {
                      console.log('Unrecognized layout specification.');
                    }
                  }
                }
              }.bind(this),
              dataSource: this.renderables
            });
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
          }
        }, {}, $__super);
      }(FamousView));
      $__export("View", View);
    }
  };
});

System.register("github:Bizboard/arva-utils@master/Context", [], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/arva-utils@master/Context";
  var contextContainer,
      Context;
  return {
    setters: [],
    execute: function() {
      contextContainer = {};
      Context = {
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
      };
      $__export("Context", Context);
    }
  };
});

System.register("github:Bizboard/di.js@master/annotations", ["github:Bizboard/di.js@master/util"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master/annotations";
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
    var $__4 = true;
    var $__5 = false;
    var $__6 = undefined;
    try {
      for (var $__2 = void 0,
          $__1 = (fn.annotations)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__4 = ($__2 = $__1.next()).done); $__4 = true) {
        var annotation = $__2.value;
        {
          if (annotation instanceof annotationClass) {
            return true;
          }
        }
      }
    } catch ($__7) {
      $__5 = true;
      $__6 = $__7;
    } finally {
      try {
        if (!$__4 && $__1.return != null) {
          $__1.return();
        }
      } finally {
        if ($__5) {
          throw $__6;
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
      var $__4 = true;
      var $__5 = false;
      var $__6 = undefined;
      try {
        for (var $__2 = void 0,
            $__1 = (fn.annotations)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__4 = ($__2 = $__1.next()).done); $__4 = true) {
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
      } catch ($__7) {
        $__5 = true;
        $__6 = $__7;
      } finally {
        try {
          if (!$__4 && $__1.return != null) {
            $__1.return();
          }
        } finally {
          if ($__5) {
            throw $__6;
          }
        }
      }
    }
    if (fn.parameters) {
      fn.parameters.forEach((function(param, idx) {
        var $__11 = true;
        var $__12 = false;
        var $__13 = undefined;
        try {
          for (var $__9 = void 0,
              $__8 = (param)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__11 = ($__9 = $__8.next()).done); $__11 = true) {
            var paramAnnotation = $__9.value;
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
        } catch ($__14) {
          $__12 = true;
          $__13 = $__14;
        } finally {
          try {
            if (!$__11 && $__8.return != null) {
              $__8.return();
            }
          } finally {
            if ($__12) {
              throw $__13;
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
        function SuperConstructor() {}
        return ($traceurRuntime.createClass)(SuperConstructor, {}, {});
      }());
      TransientScope = (function() {
        function TransientScope() {}
        return ($traceurRuntime.createClass)(TransientScope, {}, {});
      }());
      Inject = (function() {
        function Inject() {
          for (var tokens = [],
              $__15 = 0; $__15 < arguments.length; $__15++)
            tokens[$__15] = arguments[$__15];
          this.tokens = tokens;
          this.isPromise = false;
          this.isLazy = false;
        }
        return ($traceurRuntime.createClass)(Inject, {}, {});
      }());
      InjectPromise = (function($__super) {
        function InjectPromise() {
          for (var tokens = [],
              $__15 = 0; $__15 < arguments.length; $__15++)
            tokens[$__15] = arguments[$__15];
          $traceurRuntime.superConstructor(InjectPromise).call(this, tokens);
          this.tokens = tokens;
          this.isPromise = true;
          this.isLazy = false;
        }
        return ($traceurRuntime.createClass)(InjectPromise, {}, {}, $__super);
      }(Inject));
      InjectLazy = (function($__super) {
        function InjectLazy() {
          for (var tokens = [],
              $__15 = 0; $__15 < arguments.length; $__15++)
            tokens[$__15] = arguments[$__15];
          $traceurRuntime.superConstructor(InjectLazy).call(this, tokens);
          this.tokens = tokens;
          this.isPromise = false;
          this.isLazy = true;
        }
        return ($traceurRuntime.createClass)(InjectLazy, {}, {}, $__super);
      }(Inject));
      Provide = (function() {
        function Provide(token) {
          this.token = token;
          this.isPromise = false;
        }
        return ($traceurRuntime.createClass)(Provide, {}, {});
      }());
      ProvidePromise = (function($__super) {
        function ProvidePromise(token) {
          $traceurRuntime.superConstructor(ProvidePromise).call(this, token);
          this.token = token;
          this.isPromise = true;
        }
        return ($traceurRuntime.createClass)(ProvidePromise, {}, {}, $__super);
      }(Provide));
      ClassProvider = (function() {
        function ClassProvider() {}
        return ($traceurRuntime.createClass)(ClassProvider, {}, {});
      }());
      FactoryProvider = (function() {
        function FactoryProvider() {}
        return ($traceurRuntime.createClass)(FactoryProvider, {}, {});
      }());
      $__export("annotate", annotate), $__export("hasAnnotation", hasAnnotation), $__export("readAnnotations", readAnnotations), $__export("SuperConstructor", SuperConstructor), $__export("TransientScope", TransientScope), $__export("Inject", Inject), $__export("InjectPromise", InjectPromise), $__export("InjectLazy", InjectLazy), $__export("Provide", Provide), $__export("ProvidePromise", ProvidePromise), $__export("ClassProvider", ClassProvider), $__export("FactoryProvider", FactoryProvider);
    }
  };
});

System.register("DefaultContext", ["github:Bizboard/di.js@master", "routers/ArvaRouter", "github:Bizboard/arva-utils@master/Context", "npm:famous@0.3.5/core/Engine", "npm:famous@0.3.5/core/Context", "github:ijzerenhein/famous-flex@0.3.2/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "DefaultContext";
  var Injector,
      Provide,
      ArvaRouter,
      ArvaContext,
      Engine,
      Context,
      AnimationController,
      famousContext;
  function createFamousContext() {
    if (famousContext) {
      return famousContext;
    }
    famousContext = Engine.createContext();
    return famousContext;
  }
  function newAnimationController() {
    famousContext = createFamousContext();
    var controller = new AnimationController();
    famousContext.add(controller);
    return controller;
  }
  function GetDefaultContext() {
    return ArvaContext.getContext('Default');
  }
  function reCreateDefaultContext() {
    var router = arguments[0] !== (void 0) ? arguments[0] : ArvaRouter;
    var arrayOfInjectors = [router, createFamousContext, newAnimationController];
    for (var i = 0; i < arguments.length; i++) {
      arrayOfInjectors.push(arguments[i]);
    }
    ArvaContext.setContext('Default', new Injector(arrayOfInjectors));
    return ArvaContext.getContext('Default');
  }
  $__export("GetDefaultContext", GetDefaultContext);
  $__export("reCreateDefaultContext", reCreateDefaultContext);
  return {
    setters: [function($__m) {
      Injector = $__m.Injector;
      Provide = $__m.Provide;
    }, function($__m) {
      ArvaRouter = $__m.ArvaRouter;
    }, function($__m) {
      ArvaContext = $__m.Context;
    }, function($__m) {
      Engine = $__m.default;
    }, function($__m) {
      Context = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      famousContext = null;
      Object.defineProperty(createFamousContext, "annotations", {get: function() {
          return [new Provide(Context)];
        }});
      Object.defineProperty(newAnimationController, "annotations", {get: function() {
          return [new Provide(AnimationController)];
        }});
    }
  };
});

System.register("github:Bizboard/di.js@master/injector", ["github:Bizboard/di.js@master/annotations", "github:Bizboard/di.js@master/util", "github:Bizboard/di.js@master/profiler", "github:Bizboard/di.js@master/providers"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master/injector";
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
        function Injector() {
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
        }
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
            var $__5 = true;
            var $__6 = false;
            var $__7 = undefined;
            try {
              for (var $__3 = void 0,
                  $__2 = (modules)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
                var module = $__3.value;
                {
                  if (isFunction(module)) {
                    this._loadFnOrClass(module);
                    continue;
                  }
                  throw new Error('Invalid module!');
                }
              }
            } catch ($__8) {
              $__6 = true;
              $__7 = $__8;
            } finally {
              try {
                if (!$__5 && $__2.return != null) {
                  $__2.return();
                }
              } finally {
                if ($__6) {
                  throw $__7;
                }
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
            var $__5 = true;
            var $__6 = false;
            var $__7 = undefined;
            try {
              for (var $__3 = void 0,
                  $__2 = (this._scopes)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
                var ScopeClass = $__3.value;
                {
                  if (hasAnnotation(provider.provider, ScopeClass)) {
                    this._providers.set(token, provider);
                    return this.get(token, resolving, wantPromise, wantLazy);
                  }
                }
              }
            } catch ($__8) {
              $__6 = true;
              $__7 = $__8;
            } finally {
              try {
                if (!$__5 && $__2.return != null) {
                  $__2.return();
                }
              } finally {
                if ($__6) {
                  throw $__7;
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
            var $__5 = true;
            var $__6 = false;
            var $__7 = undefined;
            try {
              for (var $__3 = void 0,
                  $__2 = (forceNewInstancesOf)[$traceurRuntime.toProperty(Symbol.iterator)](); !($__5 = ($__3 = $__2.next()).done); $__5 = true) {
                var annotation = $__3.value;
                {
                  this._collectProvidersWithAnnotation(annotation, forcedProviders);
                }
              }
            } catch ($__8) {
              $__6 = true;
              $__7 = $__8;
            } finally {
              try {
                if (!$__5 && $__2.return != null) {
                  $__2.return();
                }
              } finally {
                if ($__6) {
                  throw $__7;
                }
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

System.register("github:Bizboard/di.js@master/index", ["github:Bizboard/di.js@master/injector", "github:Bizboard/di.js@master/annotations"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master/index";
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

System.register("github:Bizboard/di.js@master", ["github:Bizboard/di.js@master/index"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/di.js@master";
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

System.register("core/Controller", ["npm:lodash@3.9.1", "github:Bizboard/di.js@master", "core/Router", "github:Bizboard/arva-utils@master/ObjectHelper", "npm:famous@0.3.5/core/EventHandler", "github:ijzerenhein/famous-flex@0.3.2/src/AnimationController"], function($__export) {
  "use strict";
  var __moduleName = "core/Controller";
  var _,
      Inject,
      Router,
      ObjectHelper,
      EventHandler,
      AnimationController,
      Controller;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }, function($__m) {
      Inject = $__m.Inject;
    }, function($__m) {
      Router = $__m.Router;
    }, function($__m) {
      ObjectHelper = $__m.ObjectHelper;
    }, function($__m) {
      EventHandler = $__m.default;
    }, function($__m) {
      AnimationController = $__m.default;
    }],
    execute: function() {
      Controller = (function() {
        function Controller(router, context, spec) {
          this.spec = spec;
          this.router = router;
          this.context = context;
          this._eventOutput = new EventHandler();
          ObjectHelper.bindAllMethods(this, this);
          var routeName = Object.getPrototypeOf(this).constructor.name.replace('Controller', '');
          routeName += '/:method';
          this.router.add(routeName, this.onRouteCalled);
        }
        return ($traceurRuntime.createClass)(Controller, {
          on: function(event, handler) {
            this._eventOutput.on(event, handler);
          },
          onRouteCalled: function(route) {
            var $__0 = this;
            if (typeof this[route.method] === 'function') {
              var result = this[route.method].apply(this, route.values);
              if (result) {
                this._eventOutput.emit('renderstart', route.method);
                if (result instanceof Promise) {
                  result.then((function(delegatedresult) {
                    $__0.context.show(delegatedresult, _.extend(route.spec, $__0.spec), (function() {
                      $__0._eventOutput.emit('renderend', route.method);
                    }));
                    $__0._eventOutput.emit('rendering', route.method);
                  }));
                } else {
                  this.context.show(result, _.extend(route.spec, this.spec), (function() {
                    $__0._eventOutput.emit('renderend', route.method);
                  }));
                  this._eventOutput.emit('rendering', route.method);
                }
                this.context.show(result, _.extend(route.spec, this.spec), function() {
                  this._eventOutput.emit('renderend', route.method);
                }.bind(this));
                this._eventOutput.emit('rendering', route.method);
              }
            } else {
              console.log('Route does not exist!');
            }
          }
        }, {});
      }());
      $__export("Controller", Controller);
      Object.defineProperty(Controller, "annotations", {get: function() {
          return [new Inject(Router, AnimationController)];
        }});
    }
  };
});

System.register("components/DataBoundScrollView", ["github:ijzerenhein/famous-flex@0.3.2/src/FlexScrollView", "npm:lodash@3.9.1"], function($__export) {
  "use strict";
  var __moduleName = "components/DataBoundScrollView";
  var FlexScrollView,
      _;
  return {
    setters: [function($__m) {
      FlexScrollView = $__m.default;
    }, function($__m) {
      _ = $__m.default;
    }],
    execute: function() {
      $__export('default', (function($__super) {
        function DataBoundScrollView() {
          var OPTIONS = arguments[0] !== (void 0) ? arguments[0] : {};
          if (OPTIONS.autoPipeEvents === undefined) {
            OPTIONS.autoPipeEvents = true;
          }
          if (OPTIONS.dataSource === undefined) {
            OPTIONS.dataSource = [];
          }
          $traceurRuntime.superConstructor(DataBoundScrollView).call(this, OPTIONS);
          if (!this.options.sortingDirection) {
            this.options.sortingDirection = 'ascending';
          }
          this.isGrouped = this.options.groupBy != null;
          this.isDescending = this.options.sortingDirection === 'descending';
          if (this.options.dataStore) {
            this._bindDataSource(this.options.dataStore);
          } else {
            console.log('No DataSource was set.');
          }
        }
        return ($traceurRuntime.createClass)(DataBoundScrollView, {
          _findGroup: function(groupId) {
            return _.findIndex(this._dataSource, function(surface) {
              return surface.groupId === groupId;
            });
          },
          _findNextGroup: function(fromIndex) {
            var dslength = this._dataSource.length;
            for (var pos = fromIndex; pos < dslength; pos++) {
              if (this._dataSource[pos].groupId) {
                return pos;
              }
            }
            return -1;
          },
          _getGroupByValue: function(child) {
            var groupByValue = '';
            if (typeof this.options.groupBy === 'function') {
              groupByValue = this.options.groupBy(child);
            } else if (typeof this.options.groupBy === 'string') {
              groupByValue = this.options.groupBy;
            }
            return groupByValue;
          },
          _addGroupItem: function(child) {
            var groupByValue = this._getGroupByValue(child);
            var newSurface = this.options.groupTemplate(groupByValue);
            newSurface.groupId = groupByValue;
            if (this.isDescending) {
              this.insert(0, newSurface);
            } else {
              this.insert(-1, newSurface);
            }
          },
          _ensureGroupItem: function(child) {
            var groupByValue = this._getGroupByValue(child);
            var groupIndex = this._findGroup(groupByValue);
            if (groupIndex > -1) {
              return groupIndex;
            } else {
              this._addGroupItem(child);
              return this._findGroup(groupByValue);
            }
          },
          _bindDataSource: function() {
            if (!this.options.dataStore || !this.options.itemTemplate) {
              console.log('Datasource and template should both be set.');
              return ;
            }
            if (!this.options.template instanceof Function) {
              console.log('Template needs to be a function.');
              return ;
            }
            this.options.dataStore.on('child_added', function(child) {
              if (!this.options.dataFilter || (typeof this.options.dataFilter === 'function' && this.options.dataFilter(child))) {
                this._addItem(child);
              }
            }.bind(this));
            this.options.dataStore.on('child_changed', function(child, previousSibling) {
              var changedItem = this._getDataSourceIndex(child.id);
              if (this._dataSource && changedItem < this._dataSource.length) {
                if (this.options.dataFilter && typeof this.options.dataFilter === 'function' && !this.options.dataFilter(child)) {
                  this._removeItem(child);
                } else {
                  if (changedItem === -1) {
                    this._addItem(child);
                    this._moveItem(child.id, previousSibling);
                  } else {
                    this._replaceItem(child);
                    this._moveItem(child.id, previousSibling);
                  }
                }
              }
            }.bind(this));
            this.options.dataStore.on('child_moved', function(child, previousSibling) {
              var current = this._getDataSourceIndex(child.id);
              var previous = this._getDataSourceIndex(previousSibling);
              this._moveItem(current, previous);
            }.bind(this));
            this.options.dataStore.on('child_removed', function(child) {
              this._removeItem(child);
            }.bind(this));
          },
          _addItem: function(child) {
            var insertIndex = this.isDescending ? 0 : -1;
            if (this.isGrouped) {
              insertIndex = this._ensureGroupItem(child);
            }
            var newSurface = this.options.itemTemplate(child);
            newSurface.dataId = child.id;
            newSurface.on('click', function() {
              this._eventOutput.emit('child_click', {
                renderNode: newSurface,
                dataObject: child
              });
            }.bind(this));
            if (this.isGrouped) {
              if (this.isDescending) {
                insertIndex++;
              } else {
                insertIndex = this._findNextGroup(insertIndex) + 1;
              }
            }
            this.insert(insertIndex, newSurface);
          },
          _replaceItem: function(child) {
            var index = this._getDataSourceIndex(child.id);
            var newSurface = this.options.itemTemplate(child);
            newSurface.dataId = child.id;
            this.replace(index, newSurface);
          },
          _removeItem: function(child) {
            var index = _.findIndex(this._dataSource, function(surface) {
              return surface.dataId === child.id;
            });
            if (index > -1) {
              this.remove(index);
            }
          },
          _moveItem: function(oldId) {
            var prevChildId = arguments[1] !== (void 0) ? arguments[1] : null;
            var oldIndex = this._getDataSourceIndex(oldId);
            var previousSiblingIndex = this._getNextVisibleIndex(prevChildId);
            if (oldIndex !== previousSiblingIndex) {
              this.move(oldIndex, previousSiblingIndex);
            }
          },
          _getDataSourceIndex: function(id) {
            return _.findIndex(this._dataSource, function(surface) {
              return surface.dataId === id;
            });
          },
          _getNextVisibleIndex: function(id) {
            var viewIndex = this._getDataSourceIndex(id);
            if (viewIndex === -1) {
              var modelIndex = _.findIndex(this.options.dataStore, function(model) {
                return model.id === id;
              });
              if (modelIndex === 0 || modelIndex === -1) {
                return this.isDescending ? this._dataSource ? this._dataSource.length - 1 : 0 : 0;
              } else {
                var nextModel = this.options.dataStore[this.isDescending ? modelIndex + 1 : modelIndex - 1];
                var nextIndex = this._getDataSourceIndex(nextModel.id);
                if (nextIndex > -1) {
                  var newIndex = this.isDescending ? nextIndex === 0 ? 0 : nextIndex - 1 : this._dataSource.length === nextIndex + 1 ? nextIndex : nextIndex + 1;
                  return newIndex;
                } else {
                  return this._getNextVisibleIndex(nextModel.id);
                }
              }
            } else {
              var newIndex$__1 = this.isDescending ? viewIndex === 0 ? 0 : viewIndex - 1 : this._dataSource.length === viewIndex + 1 ? viewIndex : viewIndex + 1;
              return newIndex$__1;
            }
          }
        }, {}, $__super);
      }(FlexScrollView)));
    }
  };
});

System.register("github:Bizboard/arva-utils@master/ObjectHelper", ["npm:lodash@3.9.3"], function($__export) {
  "use strict";
  var __moduleName = "github:Bizboard/arva-utils@master/ObjectHelper";
  var _,
      ObjectHelper;
  return {
    setters: [function($__m) {
      _ = $__m.default;
    }],
    execute: function() {
      ObjectHelper = (function() {
        function ObjectHelper() {}
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
            try {
              if ('shadow' in object) {
                shadow = object.shadow;
              }
            } catch (error) {
              return ;
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
                return object.shadow[propName];
              },
              set: function(value) {
                if (writable) {
                  object.shadow[propName] = value;
                  if (setCallback && typeof setCallback === 'function') {
                    setCallback({
                      propertyName: propName,
                      newValue: value
                    });
                  }
                } else {
                  throw new ReferenceError('Attempted to write to non-writable property ' + propName + '.');
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
            var $__4 = true;
            var $__5 = false;
            var $__6 = undefined;
            try {
              for (var $__2 = void 0,
                  $__1 = (propNames.values())[$traceurRuntime.toProperty(Symbol.iterator)](); !($__4 = ($__2 = $__1.next()).done); $__4 = true) {
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
            } catch ($__7) {
              $__5 = true;
              $__6 = $__7;
            } finally {
              try {
                if (!$__4 && $__1.return != null) {
                  $__1.return();
                }
              } finally {
                if ($__5) {
                  throw $__6;
                }
              }
            }
            var descriptorNames = Object.getOwnPropertyNames(prototype);
            descriptorNames = descriptorNames.filter(function(name) {
              return propNames.indexOf(name) < 0;
            });
            var $__11 = true;
            var $__12 = false;
            var $__13 = undefined;
            try {
              for (var $__9 = void 0,
                  $__8 = (descriptorNames.values())[$traceurRuntime.toProperty(Symbol.iterator)](); !($__11 = ($__9 = $__8.next()).done); $__11 = true) {
                var name$__15 = $__9.value;
                {
                  var descriptor = Object.getOwnPropertyDescriptor(prototype, name$__15);
                  if (descriptor && descriptor.enumerable) {
                    var value$__16 = rootObject[name$__15];
                    if (value$__16 !== null && value$__16 !== undefined && typeof value$__16 !== 'function') {
                      if (typeof value$__16 == 'object') {
                        result[name$__15] = ObjectHelper.getEnumerableProperties(value$__16);
                      } else {
                        result[name$__15] = value$__16;
                      }
                    }
                  }
                }
              }
            } catch ($__14) {
              $__12 = true;
              $__13 = $__14;
            } finally {
              try {
                if (!$__11 && $__8.return != null) {
                  $__8.return();
                }
              } finally {
                if ($__12) {
                  throw $__13;
                }
              }
            }
            var superPrototype = Object.getPrototypeOf(prototype);
            var ignorableTypes = ['Object', 'Array', 'EventEmitter'];
            if (ignorableTypes.indexOf(superPrototype.constructor.name) === -1) {
              var prototypeEnumerables = ObjectHelper.getPrototypeEnumerableProperties(rootObject, superPrototype);
              _.merge(result, prototypeEnumerables);
            }
            return result;
          }
        });
      }());
      $__export("ObjectHelper", ObjectHelper);
    }
  };
});

System.register("core/Router", ["npm:eventemitter3@1.1.0", "github:Bizboard/arva-utils@master/ObjectHelper"], function($__export) {
  "use strict";
  var __moduleName = "core/Router";
  var EventEmitter,
      ObjectHelper,
      Router;
  return {
    setters: [function($__m) {
      EventEmitter = $__m.default;
    }, function($__m) {
      ObjectHelper = $__m.ObjectHelper;
    }],
    execute: function() {
      Router = (function($__super) {
        function Router() {
          $traceurRuntime.superConstructor(Router).call(this);
          ObjectHelper.bindAllMethods(this, this);
          this.controllers = [];
          this.defaultController = 'Home';
          this.defaultMethod = 'Index';
        }
        return ($traceurRuntime.createClass)(Router, {
          run: function() {},
          setDefault: function(controller, method) {},
          add: function(route, handler) {},
          go: function(controller, method, params) {},
          _executeRoute: function(rule, route) {}
        }, {}, $__super);
      }(EventEmitter));
      $__export("Router", Router);
    }
  };
});

System.register("core/App", ["github:Bizboard/di.js@master", "core/Router", "npm:famous@0.3.5/core/Context"], function($__export) {
  "use strict";
  var __moduleName = "core/App";
  var Inject,
      annotate,
      Router,
      Context,
      App;
  return {
    setters: [function($__m) {
      Inject = $__m.Inject;
      annotate = $__m.annotate;
    }, function($__m) {
      Router = $__m.Router;
    }, function($__m) {
      Context = $__m.default;
    }],
    execute: function() {
      App = (function() {
        function App(router, context) {
          this.router = router;
          this.context = context;
          this.router.run();
        }
        return ($traceurRuntime.createClass)(App, {}, {});
      }());
      $__export("App", App);
      Object.defineProperty(App, "annotations", {get: function() {
          return [new Inject(Router, Context)];
        }});
    }
  };
});

System.register("main", ["core/App", "core/Controller", "core/Router", "routers/ArvaRouter", "views/View", "components/DataBoundScrollView", "DefaultContext"], function($__export) {
  "use strict";
  var __moduleName = "main";
  var $__exportNames = {};
  var $__exportNames = {};
  var $__exportNames = {};
  var $__exportNames = {};
  var $__exportNames = {};
  var $__exportNames = {};
  var $__exportNames = {};
  return {
    setters: [function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }, function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }, function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }, function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }, function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }, function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }, function($__m) {
      Object.keys($__m).forEach(function(p) {
        if (!$__exportNames[p])
          $__export(p, $__m[p]);
      });
    }],
    execute: function() {}
  };
});

});
//# sourceMappingURL=arva.js.map