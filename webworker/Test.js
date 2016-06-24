/**
 * Created by Manuel on 24/06/16.
 */


if(window.Worker){
    let myWorker = new Worker('./Worker.js');
    myWorker.postMessage('start');
}