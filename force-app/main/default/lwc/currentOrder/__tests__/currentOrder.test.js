import { createElement } from 'lwc';
import { registerTestWireAdapter,
    registerLdsTestWireAdapter,
    registerApexTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import CurrentOrder from 'c/currentOrder';
import { getRecord } from 'lightning/uiRecordApi';
import upsertOrderItems from '@salesforce/apex/ProductDataProvider.upsertOrderItems';

import { publish, subscribe, MessageContext } from 'lightning/messageService';
import MESSAGE_CHANNEL from '@salesforce/messageChannel/OrderDataChannel__c';

const messageContextWireAdapter = registerTestWireAdapter(MessageContext);

const mockGetRecord = require('./data/getRecord.json');
const getRecordWireAdapter = registerLdsTestWireAdapter(getRecord);

const mockUpsertOrderItems = require('./data/upsertOrderItems.json');
const mockMessageAddProducts = require('./data/messageAddProducts.json');


/* Mock getProductsData Apex method call. */
jest.mock('@salesforce/apex/ProductDataProvider.upsertOrderItems',
    () => {
        return {
            default: jest.fn()
        };
    },
    { virtual: true }
);


describe('c-current-order', () => {
    /* Create new component instance for each test. */
     beforeEach(() => {
         /* Mock data returned from getProductsBlock Apex method. */
         upsertOrderItems.mockResolvedValue(mockUpsertOrderItems);
         
         /* Emit Order record data for getRecord. */
         getRecordWireAdapter.emit(mockGetRecord);
         
         /* Create component and attach to DOM. */
         const element = createElement('c-current-order', {
             is: CurrentOrder
         });
         document.body.appendChild(element);

         expect(subscribe).toHaveBeenCalled();
     });
     
     afterEach(() => {
         /* Remove component and clear mock data for each test. */
         while (document.body.firstChild) {
             document.body.removeChild(document.body.firstChild);
         }
         jest.clearAllMocks();
     });
 
     function flushPromises() {
         // eslint-disable-next-line no-undef
         return new Promise((resolve) => setImmediate(resolve));
     }

     it('Test if component process Confirmation message from Lightning Message Channel', () => {
        /* Select current component. */
        const element = document.querySelector('c-current-order');
        
        /* Simulate publishing a message to message channel. */
        const payload = {"TYPE":"Confirmation"};
        publish(
            messageContextWireAdapter,
            MESSAGE_CHANNEL,
            payload
        );

        return flushPromises().then(() => {
            /* Test if Confirm button was disabled. */
            const buttonElement = element.shadowRoot.querySelector('lightning-button');
            expect(buttonElement.disabled).toBe(false);
        });
    });


    it('Test if component process AddProducts message from Lightning Message Channel', () => {
        /* Select current component. */
        const element = document.querySelector('c-current-order');
        
        /* Simulate publishing a message to message channel. */
        const payload = mockMessageAddProducts;
        publish(
            messageContextWireAdapter,
            MESSAGE_CHANNEL,
            payload
        );

        return flushPromises().then(() => {
            /* Test if upsertOrderItems method was called. */
            expect(upsertOrderItems).toHaveBeenCalled();
        });
    });


});