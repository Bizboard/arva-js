/**
 * Created by tom on 15/03/16.
 */

import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('App', () => {
    let imports = {};

    before(() => {
        //return loadDependencies({
        //    App: './src/core/App.js'
        //}).then((importedObjects) => { imports = importedObjects; });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            //let instance = new imports.App();
            //should.exist(instance);
        });
    });
});