

namespace wap.core.ui.contact {
  export interface UserSelectInputItemExtraData {
    type:number;
    id:string;
    name?: string;
    description?: string;
    text?:string;
    userCount?: number;
    matchedName?: string;
    isHistory?: boolean;
    isApplicationGroup?: boolean;
    memberIdList?: string[];
    image?: string;
    iconClass?:string;
    readonly?:boolean;
    tag?: string;
  }
}