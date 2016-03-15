/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('DataBoundScrollView', () => {
    let imports = {};

    before(() => {
        /* Mock window and document objects needed by ElementOutput.js */
        global.window = {requestAnimationFrame: () => {}, addEventListener: () => {}};
        global.document = {documentElement: {style: {}}, createDocumentFragment: () => { return {clientWidth: 1, clientHeight: 1} }};
        return loadDependencies({DataBoundScrollView: './src/components/DataBoundScrollView.js'}).then((importedObjects) => { imports = importedObjects; });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.DataBoundScrollView();
            should.exist(instance);
        });
    });
});