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
        this.storageObject[key] = value;
        return value;
    }
    removeItem(key){
        return delete this.storageObject[key];
    }
}

window.document = {documentElement:  {appendChild: () => {return {}}},appendChild: () => {return {};},getElementsByTagName: () => {return {length: 0}}, readyState: "complete", createElement:() => {return {setAttribute:() => {}}}};

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