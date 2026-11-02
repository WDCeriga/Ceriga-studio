import {Navigate} from 'react-router';
import {WorkersArea} from '../../components/WorkersArea';
export function SuperAdminWorkers(){return <WorkersArea/>;}
export function SuperAdminWorkerRoles(){return <WorkersArea rolesView/>;}
export function SuperAdminWorkerDetail(){return <Navigate to="/superadmin/workers" replace/>;}
