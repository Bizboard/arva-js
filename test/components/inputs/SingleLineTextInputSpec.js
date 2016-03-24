/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies}           from '../../meta/TestBootstrap.js';

let should = chai.should();

describe('SingleLineTextInput', () => {
    let imports = {};

    before(() => {
        /* Mock InputSurface so no attempt to insert anything into the DOM is made. */
        System.delete(System.normalizeSync('famous/surfaces/InputSurface.js'));
        System.set(System.normalizeSync('famous/surfaces/InputSurface.js'), System.newModule({default: function () {
            this.options = {};
            this.on = sinon.stub();
        }}));

        return loadDependencies({SingleLineTextInput: './src/components/inputs/SingleLineTextInput.js'}).then((importedObjects) => { imports = importedObjects; });
    });

    after(() => {
        System.delete(System.normalizeSync('famous/surfaces/InputSurface.js'));
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.SingleLineTextInput();
            should.exist(instance);
        });
    });
});