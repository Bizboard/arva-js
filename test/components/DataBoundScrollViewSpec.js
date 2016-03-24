/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies, mockDependency}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('DataBoundScrollView', () => {
    let imports = {};

    before(async function() {
        /* Mock famous-flex's FlexScrollView so no attempt to insert anything into the DOM is made. */
        mockDependency('famous-flex/FlexScrollView.js', function () { this.options = {}; });
        imports = await loadDependencies({DataBoundScrollView: './src/components/DataBoundScrollView.js'});
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
});