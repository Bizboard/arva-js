/**
 * Created by tom on 15/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('App', () => {
    let imports = {};

    before(() => {

        System.delete(System.normalizeSync('famous/core/Context.js'));
        System.set(System.normalizeSync('famous/core/Context.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('./src/utils/hotfixes/Polyfills.js'));
        System.set(System.normalizeSync('./src/utils/hotfixes/Polyfills.js'), System.newModule({ default: sinon.stub().returns({}) }));

        return loadDependencies({
            App: System.normalizeSync('./src/core/App.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        System.delete(System.normalizeSync('famous/core/Context.js'));
        System.delete(System.normalizeSync('./src/utils/hotfixes/Polyfills.js'));
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.App({run: () => {}}, null);
            should.exist(instance);
        });
    });
});