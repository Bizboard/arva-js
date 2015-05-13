/**
 This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 @author: Tom Clement (tjclement)
 @license MPL 2.0
 @copyright Bizboard, 2015

 */

import ObjectHelper from '../objectHelper';
import FirebaseDataSource from '../../models/core/datasources/firebaseDataSource';
import PrioritisedObject from '../../models/core/prioritisedObject';

export default
class FirebaseBench {
    constructor() {
        this.startTime = null;
        this.endTime = null;

        /* Bind all local methods to the current object instance, so we can refer to 'this'
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);
    }

    timeFirebaseWrites(amountOfWrites = 100) {
        this.startTime = Date.now();
        let source = new FirebaseDataSource('https://es6test.firebaseio.com').child('fb-bench');
        PrioritisedObject.buildFromDataSourcePath(source, function(priorityObject){
            priorityObject.setValueChangedCallback(function(data){
                if(data.time === 'done'){
                    this.endTime = Date.now();
                    console.log('Writing ' + amountOfWrites + ' times to firebase took ' + (this.endTime - this.startTime) + 'ms');
                    priorityObject.removeValueChangedCallback();
                }
            }.bind(this));
            this.writeToFirebase(priorityObject, 1, amountOfWrites);
        }.bind(this));
    }

    writeToFirebase(priorityObject, currentIteration, maxIterations) {
        if (currentIteration >= maxIterations) {
            priorityObject.time = 'done';
            return;
        }

        priorityObject.time = Date.now();
        setTimeout(function(){
            this.writeToFirebase(priorityObject, currentIteration + 1, maxIterations);
        }.bind(this), 0);
    }
}