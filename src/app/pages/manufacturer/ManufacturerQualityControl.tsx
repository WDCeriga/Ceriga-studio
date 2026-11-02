import '../../components/dashboard/manufacturer-dashboard.css';
import '../../components/quality/manufacturer-quality.css';
import {Link,useParams} from 'react-router';
import {QualityControlQueue}from '../../components/quality/QualityControlQueue';
import {OrderQualityControl}from '../../components/quality/OrderQualityControl';
export function ManufacturerQualityControl(){const{orderId}=useParams();return orderId?<div className="manufacturer-quality-page mx-auto max-w-6xl space-y-6"><Link to="/manufacturer/quality" className="qc-back-link">← All QC reports</Link><header className="qc-page-heading"><span className="fh-eyebrow">WORKSPACE / QUALITY CONTROL</span><h1>Production report<span>.</span></h1><p>Finished garments, clearly documented. Everything Ceriga needs for review.</p></header><OrderQualityControl key={orderId} orderId={orderId} view="quality"/></div>:<QualityControlQueue/>;}
