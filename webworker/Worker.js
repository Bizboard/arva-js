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

class Storage {

    constructor(storageObject) {
        this.storageObject = storageObject;
    }
    getItem(key){
        return this.storageObject[key];
    }
    setItem(key, value){
        return this.storageObject[key] = value;
    }
    removeItem(key){
        return delete this.storageObject[key];
    }
}

self.window.sessionStorage = new Storage({});
self.window.localStorage = new Storage({});

firebase.initializeApp({
    apiKey: "AIzaSyDSUkbCZw1AjW2m7Rvj_LH-ygbKW_34Ov0",
    authDomain: "examentrainer-bizboard.firebaseapp.com",
    databaseURL: "https://examentrainer-bizboard.firebaseio.com",
    storageBucket: "examentrainer-bizboard.appspot.com"
});

self.addEventListener('message', (evt)=>{
    console.log(evt);
});