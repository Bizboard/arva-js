export const signalr = {
    // Registers a client method. This method will be run when the server invokes the fnName specified. Defaults to the method name
    registerClientMethod: (fnName = null) => {
        return function(target, name, descriptor) {
            if(!fnName) {
                fnName = descriptor.value.name;
            }
            target.addClientMethod(fnName, descriptor.value);
            return descriptor;
        }
    },
    registerServerCallback: (fnName = null) => {
        return function(target, name, descriptor) {
            if(!fnName) {
                fnName = descriptor.value.name;
            }
            target.addServerCallback(fnName, descriptor.value)
        }
    }
}