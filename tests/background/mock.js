globalThis.sessionValues={};
globalThis.openedTabs=[];
globalThis.chrome={
 runtime:{getURL(name){return 'chrome-extension://store-test/'+name;},onMessage:{addListener(fn){globalThis.messageListener=fn;}},onStartup:{addListener(fn){globalThis.startupListener=fn;}}},
 storage:{session:{async get(key){return key?{[key]:sessionValues[key]}:{...sessionValues};},async set(values){Object.assign(sessionValues,values);}}},
 tabs:{async create(options){const id=1000+openedTabs.length;openedTabs.push({id,...options});return{id};}},
 alarms:{async create(){},onAlarm:{addListener(){}}}
};
