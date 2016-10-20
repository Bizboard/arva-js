!function(e){function r(e,r,o){return 4===arguments.length?t.apply(this,arguments):void n(e,{declarative:!0,deps:r,declare:o})}function t(e,r,t,o){n(e,{declarative:!1,deps:r,executingRequire:t,execute:o})}function n(e,r){r.name=e,e in v||(v[e]=r),r.normalizedDeps=r.deps}function o(e,r){if(r[e.groupIndex]=r[e.groupIndex]||[],-1==g.call(r[e.groupIndex],e)){r[e.groupIndex].push(e);for(var t=0,n=e.normalizedDeps.length;n>t;t++){var a=e.normalizedDeps[t],u=v[a];if(u&&!u.evaluated){var d=e.groupIndex+(u.declarative!=e.declarative);if(void 0===u.groupIndex||u.groupIndex<d){if(void 0!==u.groupIndex&&(r[u.groupIndex].splice(g.call(r[u.groupIndex],u),1),0==r[u.groupIndex].length))throw new TypeError("Mixed dependency cycle detected");u.groupIndex=d}o(u,r)}}}}function a(e){var r=v[e];r.groupIndex=0;var t=[];o(r,t);for(var n=!!r.declarative==t.length%2,a=t.length-1;a>=0;a--){for(var u=t[a],i=0;i<u.length;i++){var s=u[i];n?d(s):l(s)}n=!n}}function u(e){return y[e]||(y[e]={name:e,dependencies:[],exports:{},importers:[]})}function d(r){if(!r.module){var t=r.module=u(r.name),n=r.module.exports,o=r.declare.call(e,function(e,r){if(t.locked=!0,"object"==typeof e)for(var o in e)n[o]=e[o];else n[e]=r;for(var a=0,u=t.importers.length;u>a;a++){var d=t.importers[a];if(!d.locked)for(var i=0;i<d.dependencies.length;++i)d.dependencies[i]===t&&d.setters[i](n)}return t.locked=!1,r},{id:r.name});t.setters=o.setters,t.execute=o.execute;for(var a=0,i=r.normalizedDeps.length;i>a;a++){var l,s=r.normalizedDeps[a],c=v[s],f=y[s];f?l=f.exports:c&&!c.declarative?l=c.esModule:c?(d(c),f=c.module,l=f.exports):l=p(s),f&&f.importers?(f.importers.push(t),t.dependencies.push(f)):t.dependencies.push(null),t.setters[a]&&t.setters[a](l)}}}function i(e){var r,t=v[e];if(t)t.declarative?f(e,[]):t.evaluated||l(t),r=t.module.exports;else if(r=p(e),!r)throw new Error("Unable to load dependency "+e+".");return(!t||t.declarative)&&r&&r.__useDefault?r["default"]:r}function l(r){if(!r.module){var t={},n=r.module={exports:t,id:r.name};if(!r.executingRequire)for(var o=0,a=r.normalizedDeps.length;a>o;o++){var u=r.normalizedDeps[o],d=v[u];d&&l(d)}r.evaluated=!0;var c=r.execute.call(e,function(e){for(var t=0,n=r.deps.length;n>t;t++)if(r.deps[t]==e)return i(r.normalizedDeps[t]);throw new TypeError("Module "+e+" not declared as a dependency.")},t,n);c&&(n.exports=c),t=n.exports,t&&t.__esModule?r.esModule=t:r.esModule=s(t)}}function s(r){var t={};if(("object"==typeof r||"function"==typeof r)&&r!==e)if(m)for(var n in r)"default"!==n&&c(t,r,n);else{var o=r&&r.hasOwnProperty;for(var n in r)"default"===n||o&&!r.hasOwnProperty(n)||(t[n]=r[n])}return t["default"]=r,x(t,"__useDefault",{value:!0}),t}function c(e,r,t){try{var n;(n=Object.getOwnPropertyDescriptor(r,t))&&x(e,t,n)}catch(o){return e[t]=r[t],!1}}function f(r,t){var n=v[r];if(n&&!n.evaluated&&n.declarative){t.push(r);for(var o=0,a=n.normalizedDeps.length;a>o;o++){var u=n.normalizedDeps[o];-1==g.call(t,u)&&(v[u]?f(u,t):p(u))}n.evaluated||(n.evaluated=!0,n.module.execute.call(e))}}function p(e){if(I[e])return I[e];if("@node/"==e.substr(0,6))return I[e]=s(D(e.substr(6)));var r=v[e];if(!r)throw"Module "+e+" not present.";return a(e),f(e,[]),v[e]=void 0,r.declarative&&x(r.module.exports,"__esModule",{value:!0}),I[e]=r.declarative?r.module.exports:r.esModule}var v={},g=Array.prototype.indexOf||function(e){for(var r=0,t=this.length;t>r;r++)if(this[r]===e)return r;return-1},m=!0;try{Object.getOwnPropertyDescriptor({a:0},"a")}catch(h){m=!1}var x;!function(){try{Object.defineProperty({},"a",{})&&(x=Object.defineProperty)}catch(e){x=function(e,r,t){try{e[r]=t.value||t.get.call(e)}catch(n){}}}}();var y={},D="undefined"!=typeof System&&System._nodeRequire||"undefined"!=typeof require&&require.resolve&&"undefined"!=typeof process&&require,I={"@empty":{}};return function(e,n,o,a){return function(u){u(function(u){for(var d={_nodeRequire:D,register:r,registerDynamic:t,get:p,set:function(e,r){I[e]=r},newModule:function(e){return e}},i=0;i<n.length;i++)(function(e,r){r&&r.__esModule?I[e]=r:I[e]=s(r)})(n[i],arguments[i]);a(d);var l=p(e[0]);if(e.length>1)for(var i=1;i<e.length;i++)p(e[i]);return o?l["default"]:l})}}}("undefined"!=typeof self?self:global)

(["1"], [], true, function($__System) {
var require = this.require, exports = this.exports, module = this.module;
!function(e){function r(e,r){for(var n=e.split(".");n.length;)r=r[n.shift()];return r}function n(n){if("string"==typeof n)return r(n,e);if(!(n instanceof Array))throw new Error("Global exports must be a string or array.");for(var t={},o=!0,f=0;f<n.length;f++){var i=r(n[f],e);o&&(t["default"]=i,o=!1),t[n[f].split(".").pop()]=i}return t}function t(r){if(Object.keys)Object.keys(e).forEach(r);else for(var n in e)a.call(e,n)&&r(n)}function o(r){t(function(n){if(-1==l.call(s,n)){try{var t=e[n]}catch(o){s.push(n)}r(n,t)}})}var f,i=$__System,a=Object.prototype.hasOwnProperty,l=Array.prototype.indexOf||function(e){for(var r=0,n=this.length;n>r;r++)if(this[r]===e)return r;return-1},s=["_g","sessionStorage","localStorage","clipboardData","frames","frameElement","external","mozAnimationStartTime","webkitStorageInfo","webkitIndexedDB","mozInnerScreenY","mozInnerScreenX"];i.set("@@global-helpers",i.newModule({prepareGlobal:function(r,t,i){var a=e.define;e.define=void 0;var l;if(i){l={};for(var s in i)l[s]=e[s],e[s]=i[s]}return t||(f={},o(function(e,r){f[e]=r})),function(){var r;if(t)r=n(t);else{r={};var i,s;o(function(e,n){f[e]!==n&&"undefined"!=typeof n&&(r[e]=n,"undefined"!=typeof i?s||i===n||(s=!0):i=n)}),r=s?r:i}if(l)for(var u in l)e[u]=l[u];return e.define=a,r}}}))}("undefined"!=typeof self?self:global);
$__System.registerDynamic('1', [], false, function ($__require, $__exports, $__module) {
    var _retrieveGlobal = $__System.get("@@global-helpers").prepareGlobal($__module.id, null, null);

    (function ($__global) {
        var refs = $__global['refs'],
            firebaseApp = $__global['firebaseApp'],
            window = $__global['window'],
            localStorage = $__global['localStorage'];
        /**
         * Created by Manuel on 28/09/16.
         */

        var refs = {};
        var firebaseApp;

        var window = { 'hey': 'test' };
        self.window = window;
        var localStorage;
        window.localStorage = localStorage = {
            "98351284": "1",
            "306897109": "1",
            "917395217": "1",
            __sak: "1"
        };
        self.localStorage = localStorage;
        localStorage.getItem = function (item) {
            console.log('getItem', item);
            return localStorage[item];
        };

        localStorage.setItem = function (itemName, itemValue) {
            console.log(`setItem ${ itemName }  ${ itemValue }`);
            localStorage[itemName] = itemValue;
        };

        importScripts('https://www.gstatic.com/firebasejs/3.5.0/firebase.js');

        // import firebase         from 'firebase';

        class FirebaseWorker {

            static onMessage(event) {
                let options = JSON.parse(event.data[0]);
                if (!refs[options.clientID]) {
                    refs[options.clientID] = {};
                    refs[options.clientID].dataRef = firebaseApp.database().ref(options.path);
                    refs[options.clientID].queryRef = refs[options.clientID].dataRef;
                }

                if (FirebaseWorker[options.action]) {
                    FirebaseWorker[options.action](options);
                } else {
                    console.log(`FirebaseWorker: ${ options.action || 'action' } not supported`);
                }
            }

            static postMessage(options = {}) {
                self.postMessage(JSON.stringify(options));
            }

            static subscribe(options = {}) {
                refs[options.clientID].queryRef.on(options.event, (snapshot, prevSiblingId = undefined) => {
                    options.result = { key: snapshot.key, value: snapshot.val(), numChildren: snapshot.numChildren(), prevSiblingId: prevSiblingId };
                    FirebaseWorker.postMessage(options);
                });
            }

            static unsubscribe(options = {}) {
                refs[options.clientID].queryRef.off(options.event);
                options.result = 'completed';
                FirebaseWorker.postMessage(options.event);
            }

            static value(options = {}) {
                refs[options.clientID].queryRef.once('value', (snapshot, prevSiblingId = undefined) => {
                    options.result = { key: snapshot.key, value: snapshot.val(), numChildren: snapshot.numChildren(), prevSiblingId: prevSiblingId };
                    FirebaseWorker.postMessage(options);
                });
            }

            static action(options = {}) {
                refs[options.clientID].dataRef[options.action](options.data || null);
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static set(options = {}) {
                FirebaseWorker.action(options);
            }

            static push(options = {}) {
                var pushResult = refs[options.clientID].dataRef[options.action](options.data);
                options.result = { key: pushResult.key };
                FirebaseWorker.postMessage(options);
            }

            static setWithPriority(options = {}) {
                refs[options.clientID].dataRef[options.action](options.data, options.priority);
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static remove(options = {}) {
                refs[options.clientID].dataRef[options.action](options.data);
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static setPriority(options = {}) {
                refs[options.clientID].dataRef[options.action](options.priority);
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static limitToFirst(options = {}) {
                refs[options.clientID].queryRef = refs[options.clientID].dataRef.limitToFirst(options.data);
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static limitToLast(options = {}) {
                refs[options.clientID].queryRef = refs[options.clientID].dataRef.limitToLast(options.data);
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static orderByPriority(options = {}) {
                refs[options.clientID].queryRef = refs[options.clientID].dataRef.orderByPriority();
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static orderByValue(options = {}) {
                refs[options.clientID].queryRef = refs[options.clientID].dataRef.orderByValue();
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static orderByChild(options = {}) {
                refs[options.clientID].queryRef = refs[options.clientID].dataRef.orderByChild();
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static auth(options = {}) {
                options.result = firebase.auth().currentUser;
                FirebaseWorker.postMessage(options);
            }

            static signOut(options = {}) {
                firebaseApp.auth().signOut();
                options.result = 'completed';
                FirebaseWorker.postMessage(options);
            }

            static signInWithCredential(options = {}) {
                let result = firebaseApp.auth().authWithOAuthToken(options.data);
                options.result = { uid: result.uid };
                FirebaseWorker.postMessage(options);
            }

            static signInWithCustomToken(options = {}) {
                let result = firebaseApp.auth().signInWithCustomToken(options.data);
                options.result = { uid: result.uid };
                FirebaseWorker.postMessage(options);
            }

            static signInWithEmailAndPassword(options = {}) {
                let result = firebaseApp.auth().signInWithEmailAndPassword(options.data.email, options.data.password);
                options.result = {
                    uid: result.uid, profile: { email: result.email, password: result.password }
                };
                FirebaseWorker.postMessage(options);
            }

            static async signInAnonymously(options = {}) {
                let result = await firebaseApp.auth().signInAnonymously();
                options.result = { uid: result.uid };
                FirebaseWorker.postMessage(options);
            }

            static onAuthStateChanged(options = {}) {
                firebaseApp.auth().onAuthStateChanged(({ uid }) => {
                    options.result = uid;
                    FirebaseWorker.postMessage(options);
                });
            }

        }

        self.onmessage = event => {
            let options = JSON.parse(event.data[0]);
            if (options.databaseURL) {
                console.log("FB setting config");
                firebaseApp = firebase.initializeApp(options);
                self.onmessage = FirebaseWorker.onMessage;
            } else {
                FirebaseWorker.onMessage(event);
            }
        };
        $__global['refs'] = refs;
        $__global['firebaseApp'] = firebaseApp;
        $__global['window'] = window;
        $__global['localStorage'] = localStorage;
    })(this);

    return _retrieveGlobal();
});
})
(function(factory) {
  if (typeof define == 'function' && define.amd)
    define([], factory);
  else if (typeof module == 'object' && module.exports && typeof require == 'function')
    module.exports = factory();
  else
    factory();
});
//# sourceMappingURL=Worker.js.map