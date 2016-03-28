/**
 * Created by tom on 15/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies,
    mockDependency}                 from '../meta/TestBootstrap.js';

let should = chai.should();

describe('App', () => {
    let imports = {};

    before(() => {

        mockDependency('famous/core/Context.js', System.newModule({ default: sinon.stub().returns({}) }));
        mockDependency('./src/utils/hotfixes/Polyfills.js', System.newModule({ default: sinon.stub().returns({}) }));

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