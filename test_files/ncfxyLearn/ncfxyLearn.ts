declare module goog{
  function provide(name: string): void;
  function require(name: string): string;
  function base(me: Object, opt_methodName?: any, ...var_args: any[]): any;
}
declare module goog.dom{
  class DomHelper{
    haha();
  }
}
declare module goog.ui{
  class Component{
    constructor(opt_domHelper?: goog.dom.DomHelper);
    decorateInternal($element: Element);
    enterDocument();
    exitDocument();
    disposeInternal();
  }
}

declare module wap.core.app{
  class View{
    static getInstance();
    static registerComponent(name: string, vo: any);
  }
}

goog.provide('wap.core.ui.contact.UserSelectInputUserCountDialogContent');

goog.require('goog.ui.Component');
goog.require('wap.core.app.View');

namespace wap.core.ui.contact{
  export class UserSelectInputUserCountDialogContent extends goog.ui.Component{
    option_: Object;

    constructor(opt_options?: Object, opt_domHelper?:goog.dom.DomHelper){
      super(opt_domHelper);
      this.option_ = opt_options || {};
    }

    /**
     * @override
     * 
     */
    decorateInternal($element: Element){
      super.decorateInternal($element);
      wap.core.app.View.getInstance().decorateChildren(this);
    }

    /**
     * @override
     */
    enterDocument(){
      super.enterDocument();
    }

    exitDocument(){
      super.exitDocument();
    }

    disposeInternal(){
      super.disposeInternal();
    }
  }
}

wap.core.app.View.registerComponent('wap.core.ui.contact.UserSelectInputUserCountDialogContent',
  wap.core.ui.contact.UserSelectInputUserCountDialogContent);
