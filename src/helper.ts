export const checkType = (target: any, type: "string" | "number" | "boolean" | "function" | "object", name: string) => {
  if (typeof target != type) {
      throw new Error('Expected ' + name + ' to have type "' + type + '", but got "' + typeof target + '" instead');
  }
}
