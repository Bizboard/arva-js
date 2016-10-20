/**
 * Created by Manuel on 28/09/16.
 */
import firebase         from 'firebase';
var refs = {};
var firebaseApp;

class FirebaseWorker {

    static onMessage(event){
        let options = JSON.parse(event.data[0]);
        if (!refs[options.clientID]) {
            refs[options.clientID] = {};
            refs[options.clientID].dataRef = firebaseApp.database().ref(options.path);
            refs[options.clientID].queryRef = refs[options.clientID].dataRef;
        }

        if(FirebaseWorker[options.action]){
            FirebaseWorker[options.action](options);
        } else {
            console.log(`FirebaseWorker: ${options.action || 'action'} not supported`);
        }
    }

    static postMessage(options = {}){
        self.postMessage(JSON.stringify(options));
    }

    static subscribe(options = {}) {
        refs[options.clientID].queryRef.on(options.event, (snapshot, prevSiblingId = undefined)=> {
            options.result = {key: snapshot.key, value: snapshot.val(), numChildren: snapshot.numChildren(), prevSiblingId: prevSiblingId};
            FirebaseWorker.postMessage(options);
        });
    }

    static unsubscribe(options = {}) {
        refs[options.clientID].queryRef.off(options.event);
        options.result = 'completed';
        FirebaseWorker.postMessage(options.event);
    }

    static value(options = {}){
        refs[options.clientID].queryRef.once('value', (snapshot, prevSiblingId = undefined)=> {
            options.result = {key: snapshot.key, value: snapshot.val(), numChildren: snapshot.numChildren(), prevSiblingId: prevSiblingId};
            FirebaseWorker.postMessage(options);
        });
    }

    static action(options = {}){
        refs[options.clientID].dataRef[options.action](options.data || null);
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static set(options = {}){
        FirebaseWorker.action(options);
    }

    static push(options = {}){
        var pushResult = refs[options.clientID].dataRef[options.action](options.data);
        options.result = {key: pushResult.key};
        FirebaseWorker.postMessage(options);
    }

    static setWithPriority(options = {}){
        refs[options.clientID].dataRef[options.action](options.data, options.priority);
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static remove(options = {}){
        refs[options.clientID].dataRef[options.action](options.data);
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static setPriority(options = {}){
        refs[options.clientID].dataRef[options.action](options.priority);
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static limitToFirst(options = {}){
        refs[options.clientID].queryRef = refs[options.clientID].dataRef.limitToFirst(options.data);
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static limitToLast(options = {}){
        refs[options.clientID].queryRef = refs[options.clientID].dataRef.limitToLast(options.data);
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static orderByPriority(options = {}){
        refs[options.clientID].queryRef = refs[options.clientID].dataRef.orderByPriority();
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static orderByValue(options = {}){
        refs[options.clientID].queryRef = refs[options.clientID].dataRef.orderByValue();
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static orderByChild(options = {}){
        refs[options.clientID].queryRef = refs[options.clientID].dataRef.orderByChild();
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static auth(options = {}){
          options.result = firebase.auth().currentUser;
          FirebaseWorker.postMessage(options);
    }

    static signOut(options = {}){
        firebaseApp.auth().signOut();
        options.result = 'completed';
        FirebaseWorker.postMessage(options);
    }

    static signInWithCredential(options = {}){
        let result = firebaseApp.auth().authWithOAuthToken(options.data);
        options.result = {uid: result.uid};
        FirebaseWorker.postMessage(options);
    }

    static signInWithCustomToken(options = {}){
        let result = firebaseApp.auth().signInWithCustomToken(options.data);
        options.result = {uid: result.uid};
        FirebaseWorker.postMessage(options);
    }

    static signInWithEmailAndPassword(options = {}){
        let result = firebaseApp.auth().signInWithEmailAndPassword(options.data.email, options.data.password);
        options.result = {
            uid: result.uid, profile: {email: result.email, password: result.password}
        };
        FirebaseWorker.postMessage(options);
    }

    static async signInAnonymously(options = {}){
        let result = await firebaseApp.auth().signInAnonymously();
        options.result = {uid: result.uid};
        FirebaseWorker.postMessage(options);
    }

    static onAuthStateChanged(options = {}){
        firebaseApp.auth().onAuthStateChanged(({uid})=>{
            options.result = uid;
            FirebaseWorker.postMessage(options);
        });
    }

}

self.onmessage = (event)=>{
    let options = JSON.parse(event.data[0]);
    if(options.databaseURL){
        console.log("FB setting config");
        firebaseApp = firebase.initializeApp(options);
        self.onmessage = FirebaseWorker.onMessage;
    } else {
        FirebaseWorker.onMessage(event);
    }
};

