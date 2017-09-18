
module unexported.a.b {
  export class Unexported {}
}

let x: unexported.a.b.Unexported;
