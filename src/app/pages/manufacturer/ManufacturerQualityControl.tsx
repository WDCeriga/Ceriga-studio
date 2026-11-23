import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import '../../components/dashboard/manufacturer-dashboard.css';
import '../../components/quality/manufacturer-quality.css';
import {Link,useParams} from 'react-router';
import {QualityControlQueue}from '../../components/quality/QualityControlQueue';
import {OrderQualityControl}from '../../components/quality/OrderQualityControl';
export function ManufacturerQualityControl(){
  useCerigaTranslation();
const{orderId}=useParams();return orderId?<div className="manufacturer-quality-page mx-auto max-w-6xl space-y-6"><Link to="/manufacturer/quality" className="qc-back-link">{cerigaTranslate("interface.text_233545a5c686ae5a")}</Link><header className="qc-page-heading"><span className="fh-eyebrow">{cerigaTranslate("interface.text_e4277d47af319797")}</span><h1>{cerigaTranslate("interface.text_bc9a9c9bb5411bb9")}<span>.</span></h1><p>{cerigaTranslate("interface.text_ea71955dccb7a68c")}</p></header><OrderQualityControl key={orderId} orderId={orderId} view="quality"/></div>:<QualityControlQueue/>;}
