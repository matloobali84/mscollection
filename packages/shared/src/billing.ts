export const MAX_BILL_AMOUNT=2147483647;
export type Discount={type:'none'|'percentage'|'fixed';value:number};
export type Charge={label:string;amount:number};
export type BillInput={items:{quantity:number;unitPrice:number}[];shipping?:number;shippingPolicy?:{shippingFee:number;freeShippingThreshold:number};taxPercent?:number;legacyTax?:{subtotal:number;tax:number};discount?:Discount;charges?:Charge[];totalOverride?:number|null;adjustmentReason?:string};
function integer(value:number,label:string,max=MAX_BILL_AMOUNT){if(!Number.isSafeInteger(value)||value<0||value>max)throw Error(label+' must be a non-negative whole amount within the supported limit.');return BigInt(value)}
function amount(value:bigint,label:string){if(value<0n||value>BigInt(MAX_BILL_AMOUNT))throw Error(label+' exceeds the supported order amount.');return Number(value)}
function rounded(value:bigint,divisor:bigint){return (value+divisor/2n)/divisor}
function basisPoints(value:number,label:string){if(!Number.isFinite(value)||value<0||value>100||Math.abs(value*100-Math.round(value*100))>.000001)throw Error(label+' must be between 0 and 100, with at most two decimal places.');return BigInt(Math.round(value*100))}
export function calculateBill(input:BillInput){
 if(!input.items.length)throw Error('Keep at least one product or service on the bill.');
 let sum=0n;for(const item of input.items){if(!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>1000000)throw Error('Quantity must be a whole number between 1 and 1,000,000.');sum+=integer(item.unitPrice,'Unit price',100000000)*BigInt(item.quantity)}
 const subtotal=amount(sum,'Subtotal'),discount=input.discount||{type:'none',value:0};let reduction=0n;
 if(discount.type==='percentage')reduction=rounded(sum*basisPoints(discount.value,'Discount'),10000n);
 else if(discount.type==='fixed')reduction=integer(discount.value,'Fixed discount');
 else if(discount.type!=='none'||discount.value!==0)throw Error('Choose a valid discount method.');
 if(reduction>sum)throw Error('Discount cannot exceed the item subtotal.');
 const net=sum-reduction;
 const rate=input.taxPercent||0;if(!Number.isFinite(rate)||rate<0||rate>100)throw Error('Tax rate must be between 0 and 100.');
 const tax=input.legacyTax?input.legacyTax.subtotal?rounded(net*integer(input.legacyTax.tax,'Recorded tax'),integer(input.legacyTax.subtotal,'Recorded subtotal')):0n:rounded(net*BigInt(Math.round(rate*1000000)),100000000n);
 const shipping=integer(input.shipping??(input.shippingPolicy?(net>=integer(input.shippingPolicy.freeShippingThreshold,'Free delivery threshold')?0:input.shippingPolicy.shippingFee):0),'Delivery charge');let extra=0n;
 for(const charge of input.charges||[]){if(!charge.label.trim()||charge.label.length>100)throw Error('Give each additional charge a name.');extra+=integer(charge.amount,'Additional charge',100000000)}
 const calculated=net+tax+shipping+extra;const calculatedTotal=amount(calculated,'Calculated total');
 const final=input.totalOverride===null||input.totalOverride===undefined?calculated:integer(input.totalOverride,'Final payable amount');
 if(final!==calculated&&!input.adjustmentReason?.trim())throw Error('Add a reason for the final amount adjustment.');
 return {subtotal,discountAmount:amount(reduction,'Discount'),netSubtotal:amount(net,'Discounted subtotal'),shipping:Number(shipping),tax:amount(tax,'Tax'),additionalChargesTotal:amount(extra,'Additional charges'),calculatedTotal,adjustmentAmount:Number(final-calculated),total:amount(final,'Final payable amount')};
}
