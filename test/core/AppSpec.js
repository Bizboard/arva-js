/**
 * Created by tom on 15/03/16.
 */

/* global describe, it, before, beforeEach, after, afterEach */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies,
    restoreDependency,
    mockDependency,
    restoreDOMGlobals,
    mockArvaViewDependencies}       from '../meta/TestBootstrap.js';

let should = chai.should();
let expect = chai.expect;

describe('App', () => {
    let imports = {};

    before(async function() {

        await mockArvaViewDependencies();
        mockDependency('famous/core/Context.js');
        mockDependency('./src/utils/hotfixes/Polyfills.js');

        return await loadDependencies({
            App: System.normalizeSync('./src/core/App.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        restoreDOMGlobals();
        restoreDependency('famous/core/Context.js');
        restoreDependency('./src/utils/hotfixes/Polyfills.js');
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.App({run: () => {}}, null);
            should.exist(instance);
        });

        it('calls run', () => {
            let run = sinon.spy();
            new imports.App({run}, null);
            expect(run.calledOnce).to.be.true;
        });
    });
});