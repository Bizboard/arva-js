export let changeValue = Symbol('changeValue'),
            getValue   = Symbol('getValue');

let nestedPropertyPath  = Symbol('nestedPropertyPath'),
    optionParentObject  = Symbol('optionParentObject'),
    propertyName        = Symbol('propertyName'),
    optionObject        = Symbol('optionObject');

/**
 * Represents an option where data flows upwards
 */
export class InputOption {
    constructor(incomingNestedPropertyPath, incomingOptionObject, incomingOptionParentObject){
        this[nestedPropertyPath] = incomingNestedPropertyPath;
        this[optionParentObject] = incomingOptionParentObject;
        this[optionObject] = incomingOptionObject;
        this[propertyName] = incomingNestedPropertyPath[incomingNestedPropertyPath.length - 1];
    }

    [changeValue] = (newValue) => {
        let parentObject = this[optionParentObject];
        if(!parentObject){
            throw new Error('Cannot change value of root input option');
        }
        parentObject[this[propertyName]] = newValue;
    };

    [getValue] = () => this[optionObject];

}