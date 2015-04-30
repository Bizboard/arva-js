/**
 * Created by mysim1 on 25/03/15.
 */

import PrioritisedArray     from 'arva-ds/core/Model/prioritisedArray';
import Model          from 'arva-ds/core/Model';


export class ChatMessage extends Model {

    get message() { }
    get fromUser(){ }
}

export class ChatMessages extends PrioritisedArray
{
    constructor(datasource = null, datasnapshot = null) {
        super(ChatMessage, datasource, datasnapshot);
    }
}