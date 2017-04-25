/**
 * Created by Manuel on 22/07/16.
 */
import cloneDeep        from 'lodash/cloneDeep.js'
import omit             from 'lodash/omit.js';
import {Model}          from '../../core/Model';
import {DataSource}     from '../DataSource.js';
import {ObjectHelper}   from 'arva-js/utils/ObjectHelper.js';

export class LocalModel extends Model {

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = value;
    }

    _buildFromDataSource() {
    }

    constructor(id, data) {
        if(id === null) { id = `${Math.random() * 100000}`; }
        let dataSource = new DataSource();
        super(id, data, {dataSource});
        this.id = id;
        this._dataSource = dataSource;
        this._dataSource.ready = true;
    }

    static fromModel(model) {
        return LocalModel.fromModelClass(model.constructor, model.id, LocalModel.cloneModelProperties(model));
    }

    static fromModelClass(modelClass, modelID = null, constructionArguments = []) {
        let LocalizedModel = LocalModel.createClassFromModel(modelClass);
        let localizedModel = new LocalizedModel(modelID, ...constructionArguments);
        return localizedModel;
    }

    static createClassFromModel(modelClass) {
        return this.createMergedModelClass(modelClass);
    }

    static createMergedModelClass(...modelClasses) {
        class LocalizedModel extends LocalModel{}
        for(let modelPrototype of modelClasses.map(({prototype}) => prototype)){
            /* Define the properties that was defined on the modelClass, but omit things that would mess up the construction */
            Object.defineProperties(LocalizedModel.prototype, omit(ObjectHelper.getMethodDescriptors(modelPrototype),
                ['constructor', 'id', 'dataSource', 'priority', '_inheritable']));
        }
        return LocalizedModel;
    }

    static cloneModelProperties(model) {
        return cloneDeep(ObjectHelper.getEnumerableProperties(model));
    }

}
