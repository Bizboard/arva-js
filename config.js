System.config({
  baseURL: "./",
  defaultJSExtensions: true,
  transpiler: "babel",
  babelOptions: {
    "stage": 0,
    "optional": [
      "runtime",
      "es7.decorators",
      "es7.asyncFunctions",
      "optimisation.modules.system"
    ]
  },
  paths: {
    "github:*": "jspm_packages/github/*",
    "npm:*": "jspm_packages/npm/*"
  },

  map: {
    "babel": "npm:babel-core@5.8.38",
    "babel-runtime": "npm:babel-runtime@5.8.38",
    "bowser": "npm:bowser@1.3.0",
    "camelcase": "npm:camelcase@2.1.1",
    "core-js": "npm:core-js@1.2.6",
    "eventemitter3": "npm:eventemitter3@1.2.0",
    "famous": "github:bizboard/famous@0.3.12",
    "famous-bkimagesurface": "github:ijzerenhein/famous-bkimagesurface@1.0.3",
    "famous-flex": "github:bizboard/famous-flex@1.3.13",
    "fastclick": "npm:fastclick@1.0.6",
    "firebase": "github:firebase/firebase-bower@3.7.3",
    "fs": "github:jspm/nodelibs-fs@0.1.2",
    "lodash": "npm:lodash@4.13.1",
    "lodash-decorators": "npm:lodash-decorators@3.0.1",
    "ordered-hashmap": "npm:ordered-hashmap@1.0.0",
    "path": "github:jspm/nodelibs-path@0.1.0",
    "request-animation-frame-mock": "github:erykpiast/request-animation-frame-mock@0.1.8",
    "traceur": "github:jmcriffey/bower-traceur@0.0.92",
    "traceur-runtime": "github:jmcriffey/bower-traceur-runtime@0.0.90",
    "xml2js": "npm:xml2js@0.4.16",
    "github:bizboard/famous-flex@1.3.13": {
      "es6-map": "npm:es6-map@0.1.5"
    },
    "github:jspm/nodelibs-assert@0.1.0": {
      "assert": "npm:assert@1.4.1"
    },
    "github:jspm/nodelibs-buffer@0.1.1": {
      "buffer": "npm:buffer@5.0.6"
    },
    "github:jspm/nodelibs-events@0.1.1": {
      "events": "npm:events@1.0.2"
    },
    "github:jspm/nodelibs-path@0.1.0": {
      "path-browserify": "npm:path-browserify@0.0.0"
    },
    "github:jspm/nodelibs-process@0.1.2": {
      "process": "npm:process@0.11.10"
    },
    "github:jspm/nodelibs-stream@0.1.0": {
      "stream-browserify": "npm:stream-browserify@1.0.0"
    },
    "github:jspm/nodelibs-string_decoder@0.1.0": {
      "string_decoder": "npm:string_decoder@0.10.31"
    },
    "github:jspm/nodelibs-timers@0.1.0": {
      "timers-browserify": "npm:timers-browserify@1.4.2"
    },
    "github:jspm/nodelibs-util@0.1.0": {
      "util": "npm:util@0.10.3"
    },
    "github:jspm/nodelibs-vm@0.1.0": {
      "vm-browserify": "npm:vm-browserify@0.0.4"
    },
    "npm:assert@1.4.1": {
      "assert": "github:jspm/nodelibs-assert@0.1.0",
      "buffer": "github:jspm/nodelibs-buffer@0.1.1",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "util": "npm:util@0.10.3"
    },
    "npm:babel-runtime@5.8.38": {
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:buffer@5.0.6": {
      "base64-js": "npm:base64-js@1.2.0",
      "ieee754": "npm:ieee754@1.1.8"
    },
    "npm:core-js@1.2.6": {
      "fs": "github:jspm/nodelibs-fs@0.1.2",
      "path": "github:jspm/nodelibs-path@0.1.0",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "systemjs-json": "github:systemjs/plugin-json@0.1.2"
    },
    "npm:core-util-is@1.0.2": {
      "buffer": "github:jspm/nodelibs-buffer@0.1.1"
    },
    "npm:d@1.0.0": {
      "es5-ext": "npm:es5-ext@0.10.18"
    },
    "npm:es5-ext@0.10.18": {
      "es6-iterator": "npm:es6-iterator@2.0.1",
      "es6-symbol": "npm:es6-symbol@3.1.1",
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:es6-iterator@2.0.1": {
      "d": "npm:d@1.0.0",
      "es5-ext": "npm:es5-ext@0.10.18",
      "es6-symbol": "npm:es6-symbol@3.1.1"
    },
    "npm:es6-map@0.1.5": {
      "d": "npm:d@1.0.0",
      "es5-ext": "npm:es5-ext@0.10.18",
      "es6-iterator": "npm:es6-iterator@2.0.1",
      "es6-set": "npm:es6-set@0.1.5",
      "es6-symbol": "npm:es6-symbol@3.1.1",
      "event-emitter": "npm:event-emitter@0.3.5"
    },
    "npm:es6-set@0.1.5": {
      "d": "npm:d@1.0.0",
      "es5-ext": "npm:es5-ext@0.10.18",
      "es6-iterator": "npm:es6-iterator@2.0.1",
      "es6-symbol": "npm:es6-symbol@3.1.1",
      "event-emitter": "npm:event-emitter@0.3.5"
    },
    "npm:es6-symbol@3.1.1": {
      "d": "npm:d@1.0.0",
      "es5-ext": "npm:es5-ext@0.10.18"
    },
    "npm:event-emitter@0.3.5": {
      "d": "npm:d@1.0.0",
      "es5-ext": "npm:es5-ext@0.10.18",
      "events": "github:jspm/nodelibs-events@0.1.1"
    },
    "npm:inherits@2.0.1": {
      "util": "github:jspm/nodelibs-util@0.1.0"
    },
    "npm:lodash-decorators@3.0.1": {
      "lodash": "npm:lodash@4.0.1",
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:lodash@4.0.1": {
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:lodash@4.13.1": {
      "buffer": "github:jspm/nodelibs-buffer@0.1.1",
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:path-browserify@0.0.0": {
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:process@0.11.10": {
      "assert": "github:jspm/nodelibs-assert@0.1.0",
      "fs": "github:jspm/nodelibs-fs@0.1.2",
      "vm": "github:jspm/nodelibs-vm@0.1.0"
    },
    "npm:readable-stream@1.1.14": {
      "buffer": "github:jspm/nodelibs-buffer@0.1.1",
      "core-util-is": "npm:core-util-is@1.0.2",
      "events": "github:jspm/nodelibs-events@0.1.1",
      "inherits": "npm:inherits@2.0.1",
      "isarray": "npm:isarray@0.0.1",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "stream-browserify": "npm:stream-browserify@1.0.0",
      "string_decoder": "npm:string_decoder@0.10.31"
    },
    "npm:sax@1.2.1": {
      "buffer": "github:jspm/nodelibs-buffer@0.1.1",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "stream": "github:jspm/nodelibs-stream@0.1.0",
      "string_decoder": "github:jspm/nodelibs-string_decoder@0.1.0"
    },
    "npm:stream-browserify@1.0.0": {
      "events": "github:jspm/nodelibs-events@0.1.1",
      "inherits": "npm:inherits@2.0.1",
      "readable-stream": "npm:readable-stream@1.1.14"
    },
    "npm:string_decoder@0.10.31": {
      "buffer": "github:jspm/nodelibs-buffer@0.1.1"
    },
    "npm:timers-browserify@1.4.2": {
      "process": "npm:process@0.11.10"
    },
    "npm:util@0.10.3": {
      "inherits": "npm:inherits@2.0.1",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "systemjs-json": "github:systemjs/plugin-json@0.1.2"
    },
    "npm:vm-browserify@0.0.4": {
      "indexof": "npm:indexof@0.0.1"
    },
    "npm:xml2js@0.4.16": {
      "events": "github:jspm/nodelibs-events@0.1.1",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "sax": "npm:sax@1.2.1",
      "timers": "github:jspm/nodelibs-timers@0.1.0",
      "xmlbuilder": "npm:xmlbuilder@4.2.1"
    },
    "npm:xmlbuilder@4.2.1": {
      "lodash": "npm:lodash@4.13.1",
      "process": "github:jspm/nodelibs-process@0.1.2"
    }
  }
});
