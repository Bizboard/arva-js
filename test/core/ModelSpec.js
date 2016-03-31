import _                            from 'lodash';
import sinon                        from 'sinon';
import chai                         from 'chai';
import {loadDependencies,
    mockDependency}                 from '../meta/TestBootstrap.js';


let expect = chai.expect;
let should = chai.should();

describe('Model', () => {
    let imports = {};

    before(() => {
        mockDependency('./src/utils/Context.js', {
            Context: {
                getContext: () => ({
                    'get': () => ({child: () => ({once: () => 0})})
                })
            }
        });

        return loadDependencies({
            Model: System.normalizeSync('./src/core/Model.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Model('1', null, {dataSource: {once: () => {}}});
            should.exist(instance);
        });
    });

    let sampleModel = function() {
        class Person extends imports.Model{
            get name() {}
            get phone() {}
            get email() {}
        }
        let dataSource = {once: () => {}, setWithPriority: sinon.stub()};
        return new Person(...arguments, {dataSource});
    };


    describe('#definition', () => {
        it('should only be able to be assigned fields that are part of the model', () => {
            let data = {name: "Karl", status:"Busy", phone: "06137151283"};
            let instance = sampleModel('1', data);
            expect(Object.keys(instance)).to.deep.equal(['name', 'phone', 'email']);
            expect(instance.status).to.not.exist;
            expect(instance.shadow).to.deep.equal({..._.omit(data, 'status'), email: undefined});
        });
    });
    describe('#triggers', () => {
        it('triggers the setter when something is being set', () => {
            let instance = sampleModel('1', {name: "Karl"});
            let setterTrigger = sinon.spy(instance, '_onSetterTriggered');
            instance.name = "Someone else!?!?";
            instance.email = "bob@gmail.com";
            expect(setterTrigger.calledTwice).to.be.true;
        });
    });
});