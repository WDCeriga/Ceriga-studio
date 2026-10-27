import{useParams}from'react-router';
import{AssignedOrdersInbox}from'../../components/manufacturer/AssignedOrdersInbox';
import{AssignedOrderDetails}from'../../components/manufacturer/AssignedOrderDetails';
export function ManufacturerQuotations(){const{id}=useParams();return id?<AssignedOrderDetails id={id} quotationOnly/>:<AssignedOrdersInbox quotationOnly/>;}
