/**
 * Created by tom on 14/03/16.
 */

import _                            from 'lodash';
import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies, mockDependency,
    mockDOMGlobals, restoreDOMGlobals}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('DataBoundScrollView', () => {
    let imports = {};
    let on, once, off;

    before(async function() {
        mockDOMGlobals();

        let ElementOutput = await System.import('famous/core/ElementOutput');
        //Mock for the Famous Surface
        mockDependency('./ElementOutput.js', ElementOutput);
        mockDependency('famous/utilities/Timer.js');
        mockDependency('famous-flex/LayoutUtility.js', {registerHelper: function(){}, combineOptions: (one, two) => _.merge(one, two)});


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
        restoreDOMGlobals();
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.DataBoundScrollView();
            should.exist(instance);
        });
    });

    describe('#data manipulation', () => {
        it('adds children to the data source on child_added', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_added', {});
            should.exist(instance);
        });

        it('removes children from the data source on child_removed', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_removed', {});
            should.exist(instance);
        });

        it('changes children of the data source on child_changed', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_changed', {});
            should.exist(instance);
        });

        it('moves children on the data source on child_moved', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_moved', {});
            should.exist(instance);
        });
    });
});