import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shops,products,isVisible,onSale,price,visibleProducts,cartLineSchema} from './index';
test('collections depend on their active flag, not retired floor or slot assignments',()=>{assert.equal(isVisible({...shops[0],active:false}),false);assert.equal(isVisible({...shops[0],slot:null}),true);assert.equal(isVisible(shops[0],[{id:0,name:'Archived layout',active:false}]),true);assert.equal(visibleProducts(shops.map(s=>({...s,active:false}))).length,0)});

test('sale is bounded by its schedule and must lower the price',()=>{const p={...products[0],salePrice:100,saleStart:'2026-01-01T00:00:00Z',saleEnd:'2026-02-01T00:00:00Z'};assert.equal(onSale(p,Date.parse('2026-01-15')),true);assert.equal(onSale(p,Date.parse('2026-03-01')),false);assert.equal(onSale({...p,salePrice:p.price+1},Date.parse('2026-01-15')),false);assert.equal(price({...p,saleEnd:'2020-01-01'}),p.price)});
test('cart quantities reject fractional, negative, and oversized values',()=>{for(const quantity of [0,-1,1.5,21])assert.equal(cartLineSchema.safeParse({productId:'a',size:'M',color:'Sage',quantity}).success,false);assert.equal(cartLineSchema.safeParse({productId:'a',size:'M',color:'Sage',quantity:2}).success,true)});
