/**
 * Created by Manuel on 24/06/16.
 */

var handler = {
    defineProperty (target, key, descriptor) {
        self[key] = target[key] = descriptor.value;
        return true;
    }
};


window={};
self.window = new Proxy(self.window, handler);

importScripts("./firebase.js");

self.window = self;
self.window.localStorage = {
    getItem: function(){
        console.log('getItem');
    },
    setItem: function(){
        console.log('setItem');
    }
};

self.addEventListener('message', (evt)=>{
    console.log(evt);
});