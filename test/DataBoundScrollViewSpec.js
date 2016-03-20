/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('DataBoundScrollView', () => {
    let imports = {};

    before(() => {
        /* Mock famous-flex's FlexScrollView so no attempt to insert anything into the DOM is made. */
        System.delete(System.normalizeSync('famous-flex/src/FlexScrollView.js'));
        System.set(System.normalizeSync('famous-flex/src/FlexScrollView.js'), System.newModule({default: function () { this.options = {}; }}));

        return loadDependencies({DataBoundScrollView: './src/components/DataBoundScrollView.js'}).then((importedObjects) => { imports = importedObjects; });
    });

    after(() => {
        System.delete(System.normalizeSync('famous-flex/src/FlexScrollView.js'));
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.DataBoundScrollView();
            should.exist(instance);
        });
    });
});