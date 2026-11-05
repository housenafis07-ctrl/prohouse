import ComplexMediaManager from './ComplexMediaManager'
export default async function DeveloperComplexMediaPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params
 return <ComplexMediaManager complexId={id}/>
}