/**
 * Created by tom on 14/03/16.
 */

import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('SingleLineTextInput', () => {
    let imports = {};

    before(() => {
        return loadDependencies({SingleLineTextInput: './src/components/inputs/SingleLineTextInput.js'}).then((importedObjects) => { imports = importedObjects; });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.SingleLineTextInput();
            should.exist(instance);
        });
    });
});