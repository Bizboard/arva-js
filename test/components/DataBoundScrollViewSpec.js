/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies, mockDependency,
    mockDOMGlobals, restoreDOMGlobals}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('DataBoundScrollView', () => {
    let imports = {};
    let on, once, off;

    before(async function() {
        /* Mock famous-flex's FlexScrollView so no attempt to insert anything into the DOM is made. */
        //mockDependency('famous-flex/FlexScrollView.js', function () { this.options = {}; });
        mockDOMGlobals();

        mockDependency('famous/core/Group.js', function () {
            this.add = sinon.stub();
            this.render = sinon.stub();
        });

        //mockDependency('famous/core/Group.js', function(){return sinon.stub()});

        let ElementOutput = await System.import('famous/core/ElementOutput');
        //Mock for the Famous Surface
        mockDependency('./ElementOutput.js', ElementOutput);

        //System.set('famous/core/Group.js', System.newModule({default: function(){return {render: sinon.stub(), add: sinon.stub()}}}));
        mockDependency('famous/utilities/Timer.js');
        mockDependency('famous-flex/LayoutUtility.js', {registerHelper: new Function()});

        //sinon.stub().returns({add: sinon.stub(), render: sinon.stub()}

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

        it('remove children to the data source on child_removed', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_removed', {});
            should.exist(instance);
        });

        it('change children to the data source on child_changed', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_changed', {});
            should.exist(instance);
        });

        it('move things to the data source on child_moved', () => {
            let dataStore = new imports.PrioritisedArray();
            let instance = new imports.DataBoundScrollView({dataStore});
            dataStore._eventEmitter.emit('child_moved', {});
            should.exist(instance);
        });
    });
});