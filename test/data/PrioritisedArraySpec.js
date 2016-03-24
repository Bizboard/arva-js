/**
 * Created by lundfall on 3/24/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();

describe('PrioritisedArray', () => {
    let imports = {};

    before(() => {

        mockDependency('famous/surfaces/InputSurface.js');


        return loadDependencies({
            PrioritisedArray: System.normalizeSync('./src/data/PrioritisedArray.js'),
            Context: System.normalizeSync('./src/utils/Context.js'),
            DataSource: System.normalizeSync('./src/data/DataSource')
        }).then((importedObjects) => {
            imports = importedObjects;

        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            imports.Context.buildContext();
            console.log(imports.Context.getContext().get(imports.DataSource));
            let instance = new imports.PrioritisedArray();
            should.exist(instance);
        });
    });
});