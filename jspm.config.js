SystemJS.config({
  babelOptions: {
    "plugins": [
      "babel-plugin-transform-decorators-legacy",
      "babel-plugin-transform-class-properties",
      [
        "babel-plugin-transform-builtin-extend",
        {
          "globals": [
            "Array"
          ],
          "approximate": true
        }
      ],
      [
        "babel-plugin-transform-es2015-spread",
        {
          "loose": true
        }
      ],
      [
        "babel-plugin-transform-es2015-for-of",
        {
          "loose": true
        }
      ]
    ]
  },
  paths: {
    "npm:": "jspm_packages/npm/",
    "github:": "jspm_packages/github/",
    "arva-js/": "src/"
  },
  browserConfig: {
    "baseURL": "/"
  },
  devConfig: {
    "map": {
      "plugin-babel": "npm:systemjs-plugin-babel@0.0.16",
      "chai": "npm:chai@3.5.0",
      "mocha": "npm:mocha@3.1.1",
      "sinon": "npm:sinon@1.17.6",
      "child_process": "github:jspm/nodelibs-child_process@0.2.0-alpha",
      "request-animation-frame-mock": "github:erykpiast/request-animation-frame-mock@0.1.8",
      "babel-polyfill": "npm:babel-polyfill@6.16.0",
      "babel-plugin-transform-class-properties": "npm:babel-plugin-transform-class-properties@6.16.0",
      "babel-plugin-transform-es2015-spread": "npm:babel-plugin-transform-es2015-spread@6.8.0",
      "babel-plugin-transform-es2015-for-of": "npm:babel-plugin-transform-es2015-for-of@6.8.0",
      "babel-plugin-transform-object-rest-spread": "npm:babel-plugin-transform-object-rest-spread@6.16.0",
      "babel-plugin-transform-es2015-destructuring": "npm:babel-plugin-transform-es2015-destructuring@6.16.0",
      "babel-plugin-transform-async-to-generator": "npm:babel-plugin-transform-async-to-generator@6.16.0",
      "babel-plugin-transform-regenerator": "npm:babel-plugin-transform-regenerator@6.16.1",
      "babel-preset-es2015": "npm:babel-preset-es2015@6.16.0",
      "babel-plugin-transform-builtin-extend": "npm:babel-plugin-transform-builtin-extend@1.1.0",
      "babel-plugin-transform-decorators-legacy": "npm:babel-plugin-transform-decorators-legacy@1.3.4",
      "css": "github:systemjs/plugin-css@0.1.31",
      "commander": "npm:commander@2.9.0",
      "options": "npm:options@0.0.6",
      "systemjs": "npm:systemjs@0.19.39",
      "source-map": "npm:source-map@0.2.0",
      "ecc-jsbn": "npm:ecc-jsbn@0.1.1",
      "jodid25519": "npm:jodid25519@1.0.2",
      "bcrypt-pbkdf": "npm:bcrypt-pbkdf@1.0.0",
      "jsbn": "npm:jsbn@0.1.0",
      "tweetnacl": "npm:tweetnacl@0.14.3",
      "module": "github:jspm/nodelibs-module@0.2.0-alpha",
      "url": "github:jspm/nodelibs-url@0.2.0-alpha",
      "querystring": "github:jspm/nodelibs-querystring@0.2.0-alpha",
      "punycode": "github:jspm/nodelibs-punycode@0.2.0-alpha",
      "https": "github:jspm/nodelibs-https@0.2.0-alpha",
      "tls": "github:jspm/nodelibs-tls@0.2.0-alpha",
      "net": "github:jspm/nodelibs-net@0.2.0-alpha",
      "http": "github:jspm/nodelibs-http@0.2.0-alpha",
      "zlib": "github:jspm/nodelibs-zlib@0.2.0-alpha",
      "tty": "github:jspm/nodelibs-tty@0.2.0-alpha",
      "dns": "github:jspm/nodelibs-dns@0.2.0-alpha",
      "dgram": "github:jspm/nodelibs-dgram@0.2.0-alpha",
      "mock-browser": "npm:mock-browser@0.92.12"
    },
    "packages": {
      "npm:chai@3.5.0": {
        "map": {
          "assertion-error": "npm:assertion-error@1.0.2",
          "type-detect": "npm:type-detect@1.0.0",
          "deep-eql": "npm:deep-eql@0.1.3"
        }
      },
      "npm:mocha@3.1.1": {
        "map": {
          "json3": "npm:json3@3.3.2",
          "lodash.create": "npm:lodash.create@3.1.1",
          "debug": "npm:debug@2.2.0",
          "css": "github:systemjs/plugin-css@0.1.31"
        }
      },
      "npm:deep-eql@0.1.3": {
        "map": {
          "type-detect": "npm:type-detect@0.1.1"
        }
      },
      "npm:lodash.create@3.1.1": {
        "map": {
          "lodash._isiterateecall": "npm:lodash._isiterateecall@3.0.9",
          "lodash._basecreate": "npm:lodash._basecreate@3.0.3",
          "lodash._baseassign": "npm:lodash._baseassign@3.2.0"
        }
      },
      "npm:debug@2.2.0": {
        "map": {
          "ms": "npm:ms@0.7.1"
        }
      },
      "npm:lodash._baseassign@3.2.0": {
        "map": {
          "lodash._basecopy": "npm:lodash._basecopy@3.0.1",
          "lodash.keys": "npm:lodash.keys@3.1.2"
        }
      },
      "npm:lodash.keys@3.1.2": {
        "map": {
          "lodash._getnative": "npm:lodash._getnative@3.9.1",
          "lodash.isarguments": "npm:lodash.isarguments@3.1.0",
          "lodash.isarray": "npm:lodash.isarray@3.0.4"
        }
      },
      "npm:sinon@1.17.6": {
        "map": {
          "formatio": "npm:formatio@1.1.1",
          "samsam": "npm:samsam@1.1.2",
          "util": "npm:util@0.10.3",
          "lolex": "npm:lolex@1.3.2"
        }
      },
      "npm:formatio@1.1.1": {
        "map": {
          "samsam": "npm:samsam@1.1.3"
        }
      },
      "npm:util@0.10.3": {
        "map": {
          "inherits": "npm:inherits@2.0.1"
        }
      },
      "npm:babel-polyfill@6.16.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "regenerator-runtime": "npm:regenerator-runtime@0.9.5",
          "core-js": "npm:core-js@2.4.1"
        }
      },
      "npm:babel-runtime@6.11.6": {
        "map": {
          "regenerator-runtime": "npm:regenerator-runtime@0.9.5",
          "core-js": "npm:core-js@2.4.1"
        }
      },
      "github:erykpiast/request-animation-frame-mock@0.1.8": {
        "map": {
          "extend": "npm:extend@3.0.0"
        }
      },
      "npm:babel-preset-es2015@6.16.0": {
        "map": {
          "babel-plugin-transform-es2015-destructuring": "npm:babel-plugin-transform-es2015-destructuring@6.16.0",
          "babel-plugin-transform-es2015-for-of": "npm:babel-plugin-transform-es2015-for-of@6.8.0",
          "babel-plugin-transform-es2015-spread": "npm:babel-plugin-transform-es2015-spread@6.8.0",
          "babel-plugin-transform-regenerator": "npm:babel-plugin-transform-regenerator@6.16.1",
          "babel-plugin-transform-es2015-computed-properties": "npm:babel-plugin-transform-es2015-computed-properties@6.8.0",
          "babel-plugin-transform-es2015-block-scoped-functions": "npm:babel-plugin-transform-es2015-block-scoped-functions@6.8.0",
          "babel-plugin-transform-es2015-duplicate-keys": "npm:babel-plugin-transform-es2015-duplicate-keys@6.8.0",
          "babel-plugin-transform-es2015-unicode-regex": "npm:babel-plugin-transform-es2015-unicode-regex@6.11.0",
          "babel-plugin-transform-es2015-typeof-symbol": "npm:babel-plugin-transform-es2015-typeof-symbol@6.8.0",
          "babel-plugin-transform-es2015-literals": "npm:babel-plugin-transform-es2015-literals@6.8.0",
          "babel-plugin-transform-es2015-function-name": "npm:babel-plugin-transform-es2015-function-name@6.9.0",
          "babel-plugin-transform-es2015-shorthand-properties": "npm:babel-plugin-transform-es2015-shorthand-properties@6.8.0",
          "babel-plugin-transform-es2015-object-super": "npm:babel-plugin-transform-es2015-object-super@6.8.0",
          "babel-plugin-transform-es2015-sticky-regex": "npm:babel-plugin-transform-es2015-sticky-regex@6.8.0",
          "babel-plugin-transform-es2015-modules-amd": "npm:babel-plugin-transform-es2015-modules-amd@6.8.0",
          "babel-plugin-transform-es2015-modules-umd": "npm:babel-plugin-transform-es2015-modules-umd@6.12.0",
          "babel-plugin-transform-es2015-modules-systemjs": "npm:babel-plugin-transform-es2015-modules-systemjs@6.14.0",
          "babel-plugin-transform-es2015-template-literals": "npm:babel-plugin-transform-es2015-template-literals@6.8.0",
          "babel-plugin-transform-es2015-block-scoping": "npm:babel-plugin-transform-es2015-block-scoping@6.15.0",
          "babel-plugin-transform-es2015-arrow-functions": "npm:babel-plugin-transform-es2015-arrow-functions@6.8.0",
          "babel-plugin-check-es2015-constants": "npm:babel-plugin-check-es2015-constants@6.8.0",
          "babel-plugin-transform-es2015-classes": "npm:babel-plugin-transform-es2015-classes@6.14.0",
          "babel-plugin-transform-es2015-parameters": "npm:babel-plugin-transform-es2015-parameters@6.17.0",
          "babel-plugin-transform-es2015-modules-commonjs": "npm:babel-plugin-transform-es2015-modules-commonjs@6.16.0"
        }
      },
      "npm:babel-plugin-transform-async-to-generator@6.16.0": {
        "map": {
          "babel-plugin-syntax-async-functions": "npm:babel-plugin-syntax-async-functions@6.13.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-helper-remap-async-to-generator": "npm:babel-helper-remap-async-to-generator@6.16.2"
        }
      },
      "npm:babel-plugin-transform-regenerator@6.16.1": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "private": "npm:private@0.1.6"
        }
      },
      "npm:babel-plugin-transform-object-rest-spread@6.16.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-plugin-syntax-object-rest-spread": "npm:babel-plugin-syntax-object-rest-spread@6.13.0"
        }
      },
      "npm:babel-plugin-transform-es2015-destructuring@6.16.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-class-properties@6.16.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-plugin-syntax-class-properties": "npm:babel-plugin-syntax-class-properties@6.13.0",
          "babel-helper-function-name": "npm:babel-helper-function-name@6.8.0"
        }
      },
      "npm:babel-plugin-transform-es2015-spread@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-es2015-for-of@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-builtin-extend@1.1.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0"
        }
      },
      "npm:babel-plugin-transform-decorators-legacy@1.3.4": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-plugin-syntax-decorators": "npm:babel-plugin-syntax-decorators@6.13.0"
        }
      },
      "npm:babel-plugin-transform-es2015-unicode-regex@6.11.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-helper-regex": "npm:babel-helper-regex@6.9.0",
          "regexpu-core": "npm:regexpu-core@2.0.0"
        }
      },
      "npm:babel-plugin-transform-es2015-computed-properties@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-helper-define-map": "npm:babel-helper-define-map@6.9.0"
        }
      },
      "npm:babel-plugin-transform-es2015-block-scoped-functions@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-es2015-literals@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-es2015-object-super@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-helper-replace-supers": "npm:babel-helper-replace-supers@6.16.0"
        }
      },
      "npm:babel-plugin-transform-es2015-typeof-symbol@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-es2015-duplicate-keys@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:babel-plugin-transform-es2015-function-name@6.9.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-helper-function-name": "npm:babel-helper-function-name@6.8.0",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:babel-plugin-transform-es2015-shorthand-properties@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:babel-plugin-transform-es2015-sticky-regex@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-helper-regex": "npm:babel-helper-regex@6.9.0"
        }
      },
      "npm:babel-plugin-transform-es2015-modules-amd@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-plugin-transform-es2015-modules-commonjs": "npm:babel-plugin-transform-es2015-modules-commonjs@6.16.0",
          "babel-template": "npm:babel-template@6.16.0"
        }
      },
      "npm:babel-plugin-transform-es2015-modules-systemjs@6.14.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-helper-hoist-variables": "npm:babel-helper-hoist-variables@6.8.0"
        }
      },
      "npm:babel-plugin-transform-es2015-modules-umd@6.12.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-plugin-transform-es2015-modules-amd": "npm:babel-plugin-transform-es2015-modules-amd@6.8.0",
          "babel-template": "npm:babel-template@6.16.0"
        }
      },
      "npm:babel-types@6.16.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "esutils": "npm:esutils@2.0.2",
          "lodash": "npm:lodash@4.16.4",
          "to-fast-properties": "npm:to-fast-properties@1.0.2"
        }
      },
      "npm:babel-plugin-transform-es2015-block-scoping@6.15.0": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-traverse": "npm:babel-traverse@6.16.0",
          "lodash": "npm:lodash@4.16.4"
        }
      },
      "npm:babel-helper-remap-async-to-generator@6.16.2": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-helper-function-name": "npm:babel-helper-function-name@6.8.0",
          "babel-traverse": "npm:babel-traverse@6.16.0"
        }
      },
      "npm:babel-plugin-transform-es2015-parameters@6.17.0": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-helper-get-function-arity": "npm:babel-helper-get-function-arity@6.8.0",
          "babel-traverse": "npm:babel-traverse@6.16.0",
          "babel-helper-call-delegate": "npm:babel-helper-call-delegate@6.8.0"
        }
      },
      "npm:babel-plugin-transform-es2015-modules-commonjs@6.16.0": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-plugin-transform-strict-mode": "npm:babel-plugin-transform-strict-mode@6.11.3"
        }
      },
      "npm:babel-plugin-transform-es2015-arrow-functions@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-check-es2015-constants@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-plugin-transform-es2015-template-literals@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-template@6.16.0": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-traverse": "npm:babel-traverse@6.16.0",
          "lodash": "npm:lodash@4.16.4",
          "babylon": "npm:babylon@6.11.4"
        }
      },
      "npm:babel-helper-function-name@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-helper-get-function-arity": "npm:babel-helper-get-function-arity@6.8.0",
          "babel-traverse": "npm:babel-traverse@6.16.0"
        }
      },
      "npm:babel-helper-replace-supers@6.16.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-traverse": "npm:babel-traverse@6.16.0",
          "babel-helper-optimise-call-expression": "npm:babel-helper-optimise-call-expression@6.8.0",
          "babel-messages": "npm:babel-messages@6.8.0"
        }
      },
      "npm:babel-plugin-transform-es2015-classes@6.14.0": {
        "map": {
          "babel-traverse": "npm:babel-traverse@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-helper-function-name": "npm:babel-helper-function-name@6.8.0",
          "babel-helper-replace-supers": "npm:babel-helper-replace-supers@6.16.0",
          "babel-template": "npm:babel-template@6.16.0",
          "babel-helper-define-map": "npm:babel-helper-define-map@6.9.0",
          "babel-helper-optimise-call-expression": "npm:babel-helper-optimise-call-expression@6.8.0",
          "babel-messages": "npm:babel-messages@6.8.0"
        }
      },
      "npm:babel-helper-regex@6.9.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "lodash": "npm:lodash@4.16.4",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:babel-helper-hoist-variables@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:babel-helper-define-map@6.9.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "lodash": "npm:lodash@4.16.4",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-helper-function-name": "npm:babel-helper-function-name@6.8.0"
        }
      },
      "npm:babel-plugin-transform-strict-mode@6.11.3": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:babel-helper-call-delegate@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0",
          "babel-traverse": "npm:babel-traverse@6.16.0",
          "babel-helper-hoist-variables": "npm:babel-helper-hoist-variables@6.8.0"
        }
      },
      "npm:babel-traverse@6.16.0": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "lodash": "npm:lodash@4.16.4",
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babylon": "npm:babylon@6.11.4",
          "babel-messages": "npm:babel-messages@6.8.0",
          "invariant": "npm:invariant@2.2.1",
          "globals": "npm:globals@8.18.0",
          "babel-code-frame": "npm:babel-code-frame@6.16.0",
          "debug": "npm:debug@2.2.0"
        }
      },
      "npm:babel-helper-get-function-arity@6.8.0": {
        "map": {
          "babel-types": "npm:babel-types@6.16.0",
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-helper-optimise-call-expression@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6",
          "babel-types": "npm:babel-types@6.16.0"
        }
      },
      "npm:regexpu-core@2.0.0": {
        "map": {
          "regenerate": "npm:regenerate@1.3.1",
          "regjsgen": "npm:regjsgen@0.2.0",
          "regjsparser": "npm:regjsparser@0.1.5"
        }
      },
      "npm:babel-messages@6.8.0": {
        "map": {
          "babel-runtime": "npm:babel-runtime@6.11.6"
        }
      },
      "npm:babel-code-frame@6.16.0": {
        "map": {
          "esutils": "npm:esutils@2.0.2",
          "chalk": "npm:chalk@1.1.3",
          "js-tokens": "npm:js-tokens@2.0.0"
        }
      },
      "npm:invariant@2.2.1": {
        "map": {
          "loose-envify": "npm:loose-envify@1.2.0"
        }
      },
      "npm:loose-envify@1.2.0": {
        "map": {
          "js-tokens": "npm:js-tokens@1.0.3"
        }
      },
      "npm:regjsparser@0.1.5": {
        "map": {
          "jsesc": "npm:jsesc@0.5.0"
        }
      },
      "npm:chalk@1.1.3": {
        "map": {
          "has-ansi": "npm:has-ansi@2.0.0",
          "ansi-styles": "npm:ansi-styles@2.2.1",
          "strip-ansi": "npm:strip-ansi@3.0.1",
          "supports-color": "npm:supports-color@2.0.0",
          "escape-string-regexp": "npm:escape-string-regexp@1.0.5"
        }
      },
      "npm:strip-ansi@3.0.1": {
        "map": {
          "ansi-regex": "npm:ansi-regex@2.0.0"
        }
      },
      "npm:has-ansi@2.0.0": {
        "map": {
          "ansi-regex": "npm:ansi-regex@2.0.0"
        }
      },
      "npm:commander@2.9.0": {
        "map": {
          "graceful-readlink": "npm:graceful-readlink@1.0.1"
        }
      },
      "npm:systemjs@0.19.39": {
        "map": {
          "when": "npm:when@3.7.7"
        }
      },
      "npm:source-map@0.2.0": {
        "map": {
          "amdefine": "npm:amdefine@1.0.0"
        }
      },
      "npm:jodid25519@1.0.2": {
        "map": {
          "jsbn": "npm:jsbn@0.1.0"
        }
      },
      "npm:ecc-jsbn@0.1.1": {
        "map": {
          "jsbn": "npm:jsbn@0.1.0"
        }
      },
      "npm:bcrypt-pbkdf@1.0.0": {
        "map": {
          "tweetnacl": "npm:tweetnacl@0.14.3"
        }
      },
      "github:jspm/nodelibs-http@0.2.0-alpha": {
        "map": {
          "http-browserify": "npm:stream-http@2.4.0"
        }
      },
      "github:jspm/nodelibs-punycode@0.2.0-alpha": {
        "map": {
          "punycode-browserify": "npm:punycode@1.4.1"
        }
      },
      "github:jspm/nodelibs-url@0.2.0-alpha": {
        "map": {
          "url-browserify": "npm:url@0.11.0"
        }
      },
      "npm:stream-http@2.4.0": {
        "map": {
          "inherits": "npm:inherits@2.0.3",
          "readable-stream": "npm:readable-stream@2.1.5",
          "xtend": "npm:xtend@4.0.1",
          "builtin-status-codes": "npm:builtin-status-codes@2.0.0",
          "to-arraybuffer": "npm:to-arraybuffer@1.0.1"
        }
      },
      "github:jspm/nodelibs-zlib@0.2.0-alpha": {
        "map": {
          "zlib-browserify": "npm:browserify-zlib@0.1.4"
        }
      },
      "npm:url@0.11.0": {
        "map": {
          "punycode": "npm:punycode@1.3.2",
          "querystring": "npm:querystring@0.2.0"
        }
      },
      "npm:browserify-zlib@0.1.4": {
        "map": {
          "readable-stream": "npm:readable-stream@2.1.5",
          "pako": "npm:pako@0.2.9"
        }
      },
      "npm:mock-browser@0.92.12": {
        "map": {
          "lodash": "npm:lodash@4.16.4",
          "jsdom": "npm:jsdom@8.5.0"
        }
      },
      "npm:jsdom@8.5.0": {
        "map": {
          "array-equal": "npm:array-equal@1.0.0",
          "request": "npm:request@2.75.0",
          "acorn": "npm:acorn@2.7.0",
          "escodegen": "npm:escodegen@1.8.1",
          "cssstyle": "npm:cssstyle@0.2.37",
          "parse5": "npm:parse5@1.5.1",
          "xml-name-validator": "npm:xml-name-validator@2.0.1",
          "cssom": "npm:cssom@0.3.1",
          "nwmatcher": "npm:nwmatcher@1.3.8",
          "whatwg-url": "npm:whatwg-url@2.0.1",
          "webidl-conversions": "npm:webidl-conversions@3.0.1",
          "sax": "npm:sax@1.2.1",
          "acorn-globals": "npm:acorn-globals@1.0.9",
          "iconv-lite": "npm:iconv-lite@0.4.13",
          "tough-cookie": "npm:tough-cookie@2.3.1",
          "symbol-tree": "npm:symbol-tree@3.1.4",
          "abab": "npm:abab@1.0.3"
        }
      },
      "npm:cssstyle@0.2.37": {
        "map": {
          "cssom": "npm:cssom@0.3.1"
        }
      },
      "npm:whatwg-url@2.0.1": {
        "map": {
          "webidl-conversions": "npm:webidl-conversions@3.0.1",
          "tr46": "npm:tr46@0.0.3"
        }
      },
      "npm:request@2.75.0": {
        "map": {
          "tough-cookie": "npm:tough-cookie@2.3.1",
          "extend": "npm:extend@3.0.0",
          "json-stringify-safe": "npm:json-stringify-safe@5.0.1",
          "hawk": "npm:hawk@3.1.3",
          "mime-types": "npm:mime-types@2.1.12",
          "combined-stream": "npm:combined-stream@1.0.5",
          "oauth-sign": "npm:oauth-sign@0.8.2",
          "forever-agent": "npm:forever-agent@0.6.1",
          "is-typedarray": "npm:is-typedarray@1.0.0",
          "form-data": "npm:form-data@2.0.0",
          "tunnel-agent": "npm:tunnel-agent@0.4.3",
          "node-uuid": "npm:node-uuid@1.4.7",
          "qs": "npm:qs@6.2.1",
          "har-validator": "npm:har-validator@2.0.6",
          "isstream": "npm:isstream@0.1.2",
          "caseless": "npm:caseless@0.11.0",
          "aws-sign2": "npm:aws-sign2@0.6.0",
          "stringstream": "npm:stringstream@0.0.5",
          "http-signature": "npm:http-signature@1.1.1",
          "bl": "npm:bl@1.1.2",
          "aws4": "npm:aws4@1.4.1"
        }
      },
      "npm:escodegen@1.8.1": {
        "map": {
          "estraverse": "npm:estraverse@1.9.3",
          "esprima": "npm:esprima@2.7.3",
          "esutils": "npm:esutils@2.0.2",
          "optionator": "npm:optionator@0.8.2"
        }
      },
      "npm:acorn-globals@1.0.9": {
        "map": {
          "acorn": "npm:acorn@2.7.0"
        }
      },
      "npm:form-data@2.0.0": {
        "map": {
          "combined-stream": "npm:combined-stream@1.0.5",
          "mime-types": "npm:mime-types@2.1.12",
          "asynckit": "npm:asynckit@0.4.0"
        }
      },
      "npm:mime-types@2.1.12": {
        "map": {
          "mime-db": "npm:mime-db@1.24.0"
        }
      },
      "npm:har-validator@2.0.6": {
        "map": {
          "pinkie-promise": "npm:pinkie-promise@2.0.1",
          "is-my-json-valid": "npm:is-my-json-valid@2.15.0",
          "commander": "npm:commander@2.9.0",
          "chalk": "npm:chalk@1.1.3"
        }
      },
      "npm:combined-stream@1.0.5": {
        "map": {
          "delayed-stream": "npm:delayed-stream@1.0.0"
        }
      },
      "npm:hawk@3.1.3": {
        "map": {
          "sntp": "npm:sntp@1.0.9",
          "cryptiles": "npm:cryptiles@2.0.5",
          "boom": "npm:boom@2.10.1",
          "hoek": "npm:hoek@2.16.3"
        }
      },
      "npm:bl@1.1.2": {
        "map": {
          "readable-stream": "npm:readable-stream@2.0.6"
        }
      },
      "npm:optionator@0.8.2": {
        "map": {
          "fast-levenshtein": "npm:fast-levenshtein@2.0.5",
          "prelude-ls": "npm:prelude-ls@1.1.2",
          "levn": "npm:levn@0.3.0",
          "deep-is": "npm:deep-is@0.1.3",
          "wordwrap": "npm:wordwrap@1.0.0",
          "type-check": "npm:type-check@0.3.2"
        }
      },
      "npm:http-signature@1.1.1": {
        "map": {
          "assert-plus": "npm:assert-plus@0.2.0",
          "jsprim": "npm:jsprim@1.3.1",
          "sshpk": "npm:sshpk@1.10.1"
        }
      },
      "npm:pinkie-promise@2.0.1": {
        "map": {
          "pinkie": "npm:pinkie@2.0.4"
        }
      },
      "npm:is-my-json-valid@2.15.0": {
        "map": {
          "jsonpointer": "npm:jsonpointer@4.0.0",
          "xtend": "npm:xtend@4.0.1",
          "generate-object-property": "npm:generate-object-property@1.2.0",
          "generate-function": "npm:generate-function@2.0.0"
        }
      },
      "npm:sntp@1.0.9": {
        "map": {
          "hoek": "npm:hoek@2.16.3"
        }
      },
      "npm:cryptiles@2.0.5": {
        "map": {
          "boom": "npm:boom@2.10.1"
        }
      },
      "npm:levn@0.3.0": {
        "map": {
          "prelude-ls": "npm:prelude-ls@1.1.2",
          "type-check": "npm:type-check@0.3.2"
        }
      },
      "npm:boom@2.10.1": {
        "map": {
          "hoek": "npm:hoek@2.16.3"
        }
      },
      "npm:readable-stream@2.0.6": {
        "map": {
          "core-util-is": "npm:core-util-is@1.0.2",
          "process-nextick-args": "npm:process-nextick-args@1.0.7",
          "isarray": "npm:isarray@1.0.0",
          "util-deprecate": "npm:util-deprecate@1.0.2",
          "inherits": "npm:inherits@2.0.3",
          "string_decoder": "npm:string_decoder@0.10.31"
        }
      },
      "npm:sshpk@1.10.1": {
        "map": {
          "assert-plus": "npm:assert-plus@1.0.0",
          "dashdash": "npm:dashdash@1.14.0",
          "asn1": "npm:asn1@0.2.3",
          "getpass": "npm:getpass@0.1.6"
        }
      },
      "npm:type-check@0.3.2": {
        "map": {
          "prelude-ls": "npm:prelude-ls@1.1.2"
        }
      },
      "npm:jsprim@1.3.1": {
        "map": {
          "json-schema": "npm:json-schema@0.2.3",
          "verror": "npm:verror@1.3.6",
          "extsprintf": "npm:extsprintf@1.0.2"
        }
      },
      "npm:generate-object-property@1.2.0": {
        "map": {
          "is-property": "npm:is-property@1.0.2"
        }
      },
      "npm:verror@1.3.6": {
        "map": {
          "extsprintf": "npm:extsprintf@1.0.2"
        }
      },
      "npm:dashdash@1.14.0": {
        "map": {
          "assert-plus": "npm:assert-plus@1.0.0"
        }
      },
      "npm:getpass@0.1.6": {
        "map": {
          "assert-plus": "npm:assert-plus@1.0.0"
        }
      }
    }
  },
  transpiler: "plugin-babel",
  packages: {
    "arva-js": {
      "main": "app.js",
      "meta": {
        "*.js": {
          "loader": "plugin-babel"
        }
      }
    }
  }
});

SystemJS.config({
  packageConfigPaths: [
    "npm:@*/*.json",
    "npm:*.json",
    "github:*/*.json"
  ],
  map: {
    "assert": "github:jspm/nodelibs-assert@0.2.0-alpha",
    "bowser": "npm:bowser@1.4.6",
    "buffer": "github:jspm/nodelibs-buffer@0.2.0-alpha",
    "camelcase": "npm:camelcase@3.0.0",
    "canvas": "npm:lodash@4.16.4",
    "constants": "github:jspm/nodelibs-constants@0.2.0-alpha",
    "crypto": "github:jspm/nodelibs-crypto@0.2.0-alpha",
    "eventemitter3": "npm:eventemitter3@2.0.2",
    "events": "github:jspm/nodelibs-events@0.2.0-alpha",
    "famous": "github:bizboard/famous@0.3.9",
    "famous-flex": "github:bizboard/famous-flex@master",
    "fastclick": "npm:fastclick@1.0.6",
    "firebase": "github:firebase/firebase-bower@3.4.1",
    "fs": "github:jspm/nodelibs-fs@0.2.0-alpha",
    "lodash": "npm:lodash@4.16.4",
    "ordered-hashmap": "npm:ordered-hashmap@1.0.0",
    "os": "github:jspm/nodelibs-os@0.2.0-alpha",
    "path": "github:jspm/nodelibs-path@0.2.0-alpha",
    "process": "github:jspm/nodelibs-process@0.2.0-alpha",
    "stream": "github:jspm/nodelibs-stream@0.2.0-alpha",
    "string_decoder": "github:jspm/nodelibs-string_decoder@0.2.0-alpha",
    "timers": "github:jspm/nodelibs-timers@0.2.0-alpha",
    "util": "github:jspm/nodelibs-util@0.2.0-alpha",
    "vm": "github:jspm/nodelibs-vm@0.2.0-alpha",
    "xml2js": "npm:xml2js@0.4.17"
  },
  packages: {
    "github:jspm/nodelibs-buffer@0.2.0-alpha": {
      "map": {
        "buffer-browserify": "npm:buffer@4.9.1"
      }
    },
    "npm:buffer@4.9.1": {
      "map": {
        "base64-js": "npm:base64-js@1.2.0",
        "isarray": "npm:isarray@1.0.0",
        "ieee754": "npm:ieee754@1.1.8"
      }
    },
    "github:jspm/nodelibs-crypto@0.2.0-alpha": {
      "map": {
        "crypto-browserify": "npm:crypto-browserify@3.11.0"
      }
    },
    "github:jspm/nodelibs-os@0.2.0-alpha": {
      "map": {
        "os-browserify": "npm:os-browserify@0.2.1"
      }
    },
    "npm:crypto-browserify@3.11.0": {
      "map": {
        "inherits": "npm:inherits@2.0.3",
        "pbkdf2": "npm:pbkdf2@3.0.9",
        "create-hmac": "npm:create-hmac@1.1.4",
        "browserify-sign": "npm:browserify-sign@4.0.0",
        "diffie-hellman": "npm:diffie-hellman@5.0.2",
        "randombytes": "npm:randombytes@2.0.3",
        "browserify-cipher": "npm:browserify-cipher@1.0.0",
        "create-hash": "npm:create-hash@1.1.2",
        "create-ecdh": "npm:create-ecdh@4.0.0",
        "public-encrypt": "npm:public-encrypt@4.0.0"
      }
    },
    "npm:pbkdf2@3.0.9": {
      "map": {
        "create-hmac": "npm:create-hmac@1.1.4"
      }
    },
    "npm:create-hmac@1.1.4": {
      "map": {
        "inherits": "npm:inherits@2.0.3",
        "create-hash": "npm:create-hash@1.1.2"
      }
    },
    "npm:browserify-sign@4.0.0": {
      "map": {
        "create-hmac": "npm:create-hmac@1.1.4",
        "inherits": "npm:inherits@2.0.3",
        "create-hash": "npm:create-hash@1.1.2",
        "browserify-rsa": "npm:browserify-rsa@4.0.1",
        "elliptic": "npm:elliptic@6.3.2",
        "parse-asn1": "npm:parse-asn1@5.0.0",
        "bn.js": "npm:bn.js@4.11.6"
      }
    },
    "npm:create-hash@1.1.2": {
      "map": {
        "inherits": "npm:inherits@2.0.3",
        "sha.js": "npm:sha.js@2.4.5",
        "cipher-base": "npm:cipher-base@1.0.3",
        "ripemd160": "npm:ripemd160@1.0.1"
      }
    },
    "npm:public-encrypt@4.0.0": {
      "map": {
        "create-hash": "npm:create-hash@1.1.2",
        "randombytes": "npm:randombytes@2.0.3",
        "browserify-rsa": "npm:browserify-rsa@4.0.1",
        "parse-asn1": "npm:parse-asn1@5.0.0",
        "bn.js": "npm:bn.js@4.11.6"
      }
    },
    "npm:diffie-hellman@5.0.2": {
      "map": {
        "randombytes": "npm:randombytes@2.0.3",
        "bn.js": "npm:bn.js@4.11.6",
        "miller-rabin": "npm:miller-rabin@4.0.0"
      }
    },
    "npm:create-ecdh@4.0.0": {
      "map": {
        "elliptic": "npm:elliptic@6.3.2",
        "bn.js": "npm:bn.js@4.11.6"
      }
    },
    "npm:browserify-cipher@1.0.0": {
      "map": {
        "browserify-des": "npm:browserify-des@1.0.0",
        "browserify-aes": "npm:browserify-aes@1.0.6",
        "evp_bytestokey": "npm:evp_bytestokey@1.0.0"
      }
    },
    "npm:browserify-rsa@4.0.1": {
      "map": {
        "bn.js": "npm:bn.js@4.11.6",
        "randombytes": "npm:randombytes@2.0.3"
      }
    },
    "npm:parse-asn1@5.0.0": {
      "map": {
        "create-hash": "npm:create-hash@1.1.2",
        "pbkdf2": "npm:pbkdf2@3.0.9",
        "browserify-aes": "npm:browserify-aes@1.0.6",
        "evp_bytestokey": "npm:evp_bytestokey@1.0.0",
        "asn1.js": "npm:asn1.js@4.8.1"
      }
    },
    "npm:elliptic@6.3.2": {
      "map": {
        "bn.js": "npm:bn.js@4.11.6",
        "inherits": "npm:inherits@2.0.3",
        "hash.js": "npm:hash.js@1.0.3",
        "brorand": "npm:brorand@1.0.6"
      }
    },
    "npm:sha.js@2.4.5": {
      "map": {
        "inherits": "npm:inherits@2.0.3"
      }
    },
    "npm:browserify-aes@1.0.6": {
      "map": {
        "cipher-base": "npm:cipher-base@1.0.3",
        "create-hash": "npm:create-hash@1.1.2",
        "evp_bytestokey": "npm:evp_bytestokey@1.0.0",
        "inherits": "npm:inherits@2.0.3",
        "buffer-xor": "npm:buffer-xor@1.0.3"
      }
    },
    "npm:evp_bytestokey@1.0.0": {
      "map": {
        "create-hash": "npm:create-hash@1.1.2"
      }
    },
    "npm:cipher-base@1.0.3": {
      "map": {
        "inherits": "npm:inherits@2.0.3"
      }
    },
    "npm:browserify-des@1.0.0": {
      "map": {
        "cipher-base": "npm:cipher-base@1.0.3",
        "inherits": "npm:inherits@2.0.3",
        "des.js": "npm:des.js@1.0.0"
      }
    },
    "npm:miller-rabin@4.0.0": {
      "map": {
        "bn.js": "npm:bn.js@4.11.6",
        "brorand": "npm:brorand@1.0.6"
      }
    },
    "npm:asn1.js@4.8.1": {
      "map": {
        "bn.js": "npm:bn.js@4.11.6",
        "inherits": "npm:inherits@2.0.3",
        "minimalistic-assert": "npm:minimalistic-assert@1.0.0"
      }
    },
    "npm:hash.js@1.0.3": {
      "map": {
        "inherits": "npm:inherits@2.0.3"
      }
    },
    "npm:des.js@1.0.0": {
      "map": {
        "inherits": "npm:inherits@2.0.3",
        "minimalistic-assert": "npm:minimalistic-assert@1.0.0"
      }
    },
    "github:jspm/nodelibs-stream@0.2.0-alpha": {
      "map": {
        "stream-browserify": "npm:stream-browserify@2.0.1"
      }
    },
    "npm:stream-browserify@2.0.1": {
      "map": {
        "inherits": "npm:inherits@2.0.3",
        "readable-stream": "npm:readable-stream@2.1.5"
      }
    },
    "npm:readable-stream@2.1.5": {
      "map": {
        "inherits": "npm:inherits@2.0.3",
        "isarray": "npm:isarray@1.0.0",
        "buffer-shims": "npm:buffer-shims@1.0.0",
        "process-nextick-args": "npm:process-nextick-args@1.0.7",
        "core-util-is": "npm:core-util-is@1.0.2",
        "string_decoder": "npm:string_decoder@0.10.31",
        "util-deprecate": "npm:util-deprecate@1.0.2"
      }
    },
    "github:jspm/nodelibs-string_decoder@0.2.0-alpha": {
      "map": {
        "string_decoder-browserify": "npm:string_decoder@0.10.31"
      }
    },
    "npm:xml2js@0.4.17": {
      "map": {
        "sax": "npm:sax@1.2.1",
        "xmlbuilder": "npm:xmlbuilder@4.2.1"
      }
    },
    "npm:xmlbuilder@4.2.1": {
      "map": {
        "lodash": "npm:lodash@4.16.4"
      }
    },
    "github:bizboard/famous-flex@master": {
      "map": {
        "es6-map": "npm:es6-map@0.1.4"
      }
    },
    "npm:es6-map@0.1.4": {
      "map": {
        "d": "npm:d@0.1.1",
        "es6-iterator": "npm:es6-iterator@2.0.0",
        "es5-ext": "npm:es5-ext@0.10.12",
        "es6-symbol": "npm:es6-symbol@3.1.0",
        "es6-set": "npm:es6-set@0.1.4",
        "event-emitter": "npm:event-emitter@0.3.4"
      }
    },
    "npm:es5-ext@0.10.12": {
      "map": {
        "es6-iterator": "npm:es6-iterator@2.0.0",
        "es6-symbol": "npm:es6-symbol@3.1.0"
      }
    },
    "npm:es6-iterator@2.0.0": {
      "map": {
        "es5-ext": "npm:es5-ext@0.10.12",
        "d": "npm:d@0.1.1",
        "es6-symbol": "npm:es6-symbol@3.1.0"
      }
    },
    "npm:d@0.1.1": {
      "map": {
        "es5-ext": "npm:es5-ext@0.10.12"
      }
    },
    "npm:es6-symbol@3.1.0": {
      "map": {
        "d": "npm:d@0.1.1",
        "es5-ext": "npm:es5-ext@0.10.12"
      }
    },
    "npm:es6-set@0.1.4": {
      "map": {
        "d": "npm:d@0.1.1",
        "es5-ext": "npm:es5-ext@0.10.12",
        "es6-iterator": "npm:es6-iterator@2.0.0",
        "es6-symbol": "npm:es6-symbol@3.1.0",
        "event-emitter": "npm:event-emitter@0.3.4"
      }
    },
    "npm:event-emitter@0.3.4": {
      "map": {
        "es5-ext": "npm:es5-ext@0.10.12",
        "d": "npm:d@0.1.1"
      }
    },
    "github:jspm/nodelibs-timers@0.2.0-alpha": {
      "map": {
        "timers-browserify": "npm:timers-browserify@1.4.2"
      }
    },
    "npm:timers-browserify@1.4.2": {
      "map": {
        "process": "npm:process@0.11.9"
      }
    }
  }
});
