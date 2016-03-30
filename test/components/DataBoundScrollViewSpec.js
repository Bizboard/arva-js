/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies, mockDependency}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('DataBoundScrollView', () => {
    let imports = {};
    let on, once, off;

    before(async function() {
        /* Mock famous-flex's FlexScrollView so no attempt to insert anything into the DOM is made. */
        mockDependency('famous-flex/FlexScrollView.js', function () { this.options = {}; });

        mockDependency('./src/utils/Context.js', {
            Context: {
                getContext: () => ({
                    'get': () => ({on, once, off, child: () => ({on, once, off})})
                })
            }
        });
        imports = await loadDependencies({
            DataBoundScrollView: './src/components/DataBoundScrollView.js',
            PrioritisedArray: './src/data/PrioritisedArray.js'});
    });

    beforeEach(() => {
        on = sinon.stub();
        once = sinon.stub();
        off = sinon.stub();
    });

    after(() => {
        System.delete(System.normalizeSync('famous-flex/FlexScrollView.js'));
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.DataBoundScrollView();
            should.exist(instance);
        });
    });

    describe('#adding to data source', () => {
        it('adds things to the data source on child_added', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_added', {});
            should.exist(instance);
        });
    });
});