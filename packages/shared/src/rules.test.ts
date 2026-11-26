import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shops,products,isVisible,onSale,price,visibleProducts,cartLineSchema,productPhoto} from './index';
import {calculateBill} from './billing';
test('collections depend on their active flag, not retired floor or slot assignments',()=>{assert.equal(isVisible({...shops[0],active:false}),false);assert.equal(isVisible({...shops[0],slot:null}),true);assert.equal(isVisible(shops[0],[{id:0,name:'Archived layout',active:false}]),true);assert.equal(visibleProducts(shops.map(s=>({...s,active:false}))).length,0)});

test('sale is bounded by its schedule and must lower the price',()=>{const p={...products[0],salePrice:100,saleStart:'2026-01-01T00:00:00Z',saleEnd:'2026-02-01T00:00:00Z'};assert.equal(onSale(p,Date.parse('2026-01-15')),true);assert.equal(onSale(p,Date.parse('2026-03-01')),false);assert.equal(onSale({...p,salePrice:p.price+1},Date.parse('2026-01-15')),false);assert.equal(price({...p,saleEnd:'2020-01-01'}),p.price)});
test('cart quantities reject fractional, negative, and oversized values',()=>{for(const quantity of [0,-1,1.5,21])assert.equal(cartLineSchema.safeParse({productId:'a',size:'M',color:'Sage',quantity}).success,false);assert.equal(cartLineSchema.safeParse({productId:'a',size:'M',color:'Sage',quantity:2}).success,true)});

test('bill discounts, charges, tax and final adjustments use deterministic whole-currency rounding',()=>{
 const input={items:[{quantity:1,unitPrice:5000}],shipping:0};
 assert.equal(calculateBill({...input,discount:{type:'percentage',value:10}}).total,4500);
 assert.equal(calculateBill({...input,discount:{type:'fixed',value:500}}).total,4500);
 const rounded=calculateBill({items:[{quantity:3,unitPrice:333}],shipping:0,taxPercent:5,discount:{type:'percentage',value:10}});assert.equal(rounded.discountAmount,100);assert.equal(rounded.tax,45);assert.equal(rounded.total,944);
 const bill=calculateBill({...input,discount:{type:'fixed',value:500},charges:[{label:'Alteration',amount:100}],totalOverride:4400,adjustmentReason:'Agreed customer price'});assert.equal(bill.calculatedTotal,4600);assert.equal(bill.adjustmentAmount,-200);assert.equal(bill.total,4400);
 assert.equal(calculateBill({...input,discount:{type:'percentage',value:100}}).total,0);
 assert.equal(calculateBill({items:[{quantity:1,unitPrice:9999}],shippingPolicy:{shippingFee:250,freeShippingThreshold:9000},discount:{type:'percentage',value:12.34}}).total,9015);
 for(const bad of [{...input,discount:{type:'fixed' as const,value:5001}},{...input,discount:{type:'percentage' as const,value:101}},{...input,totalOverride:1},{...input,items:[{quantity:1000000,unitPrice:100000000}]}])assert.throws(()=>calculateBill(bad));
});

test('the selected main image controls front photos and resized thumbnails',()=>{
 const product={...products[0],image:'/media/second.webp',media:[{url:'/media/first.webp',variants:{'256':'/media/first-256.webp','512':'/media/first-512.webp'}},{url:'/media/second.webp',variants:{'256':'/media/second-256.webp','512':'/media/second-512.webp'}}]};
 assert.equal(productPhoto(product),'/media/second-512.webp');assert.equal(productPhoto(product,'256'),'/media/second-256.webp');assert.equal(productPhoto({...product,image:'/media/custom.webp'}),'/media/custom.webp');assert.equal(productPhoto({...product,media:[]}),'/media/second.webp');assert.equal(productPhoto({...product,image:''}),'/media/first-512.webp');assert.equal(productPhoto(undefined),undefined);
});
