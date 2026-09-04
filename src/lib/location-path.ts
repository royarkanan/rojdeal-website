export type LocationPathNode={id:number;parent_id:number|null;names:Record<string,string>};
export function locationPath(nodes:LocationPathNode[],id:number,lang:string):string {
  const byId=new Map(nodes.map(node=>[node.id,node])),seen=new Set<number>(),parts:string[]=[];
  let node=byId.get(id);
  while(node&&!seen.has(node.id)){
    seen.add(node.id);const label=node.names[lang]||node.names.en||node.names.ar||'';
    if(label&&parts[0]!==label)parts.unshift(label);
    node=node.parent_id==null?undefined:byId.get(node.parent_id);
  }
  return parts.join(' — ');
}
