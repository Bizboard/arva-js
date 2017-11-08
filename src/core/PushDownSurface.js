/**
 * Created by lundfall on 18/10/2016.
 */

import {Surface} from '../surfaces/Surface';

export class PushDownSurface extends Surface {
    
    elementClass = '';
    
    allocate(allocator) {
        return allocator.allocate({type: this.elementType, insertFirst: true});
    }
}