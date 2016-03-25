/**
 * Created by lundfall on 3/24/16.
 */

import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}             from '../meta/TestBootstrap.js';

let should = chai.should();

describe('DataSource', () => {
    let imports = {};

    before(() =>  loadDependencies({
            DataSource: System.normalizeSync('./src/data/DataSource.js')}
        )
    );

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.DataSource('', {});
            should.exist(instance);
        });
    });
});