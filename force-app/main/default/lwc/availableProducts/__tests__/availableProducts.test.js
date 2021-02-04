import { createElement } from 'lwc';
import { registerTestWireAdapter,
        registerLdsTestWireAdapter,
        registerApexTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import AvailableProducts from 'c/availableProducts';
import { getRecord } from 'lightning/uiRecordApi';
import getProductsData from '@salesforce/apex/ProductDataProvider.getProductsData';

import { publish, subscribe, MessageContext } from 'lightning/messageService';
import ORDER_MC from '@salesforce/messageChannel/OrderDataChannel__c';

const messageContextWireAdapter = registerTestWireAdapter(MessageContext);

const mockGetRecord = require('./data/getRecord.json');
const getRecordWireAdapter = registerLdsTestWireAdapter(getRecord);

const mockGetProductsData = require('./data/getProductsData.json');
const mockGetSelectedRows = require('./data/getSelectedRows.json');
const mockMessageAddProduct = require('./data/messageAddProduct.json');
const mockMessageConfirmed = require('./data/messageConfirmed.json');


// Mocking getProductsData Apex method call
jest.mock('@salesforce/apex/ProductDataProvider.getProductsData',
    () => {
        return {
            default: jest.fn()
        };
    },
    { virtual: true }
);


describe('c-available-products', () => {
   beforeEach(() => {
        // Mock ProductDataBlock is returned from getProductsBlock Apex method
        getProductsData.mockResolvedValue(mockGetProductsData);
        // Emit Order record data
        getRecordWireAdapter.emit(mockGetRecord);
        // Create component and attach to DOM
        const element = createElement('c-available-products', {
            is: AvailableProducts
        });
        document.body.appendChild(element);
    });
    
    afterEach(() => {
        // Reset DOM and clear mock data for each test
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    function flushPromises() {
        // eslint-disable-next-line no-undef
        return new Promise((resolve) => setImmediate(resolve));
    }


    it('Test selected Products are posted to Ligthning Message Channel', () => {
        getRecordWireAdapter.emit(mockGetRecord);

        // Select current component.
        const element = document.querySelector('c-available-products');
        
        // Select child datatable element.
        const tableElement = element.shadowRoot.querySelector('lightning-datatable');
        
        // Dispatch rowselection event on datatable to populate required data on the current component.
        tableElement.dispatchEvent(new CustomEvent('rowselection', mockGetSelectedRows));

        // Click Button element to validate if it triggers a publish call in the current component.
        const buttonElement = element.shadowRoot.querySelector('lightning-button');
        buttonElement.click();

        return flushPromises().then(() => {
            // Test if publish was called with the correct data
            expect(publish).toHaveBeenCalledWith(
                undefined,
                ORDER_MC,
                mockMessageAddProduct
            );
        });
    });


    it('Test loadMore table action loads data block by Apex call', () => {
        getRecordWireAdapter.emit(mockGetRecord);

        // Set params for getProductsBlock Apex method
        const APEX_PARAMETERS = { orderId : 'testId', offset : 3 };

        // Select current component.
        const element = document.querySelector('c-available-products');
                
        // Select child datatable element.
        const tableElement = element.shadowRoot.querySelector('lightning-datatable');

        // Dispatch rowselection event on datatable to populate required data on the current component.
        tableElement.dispatchEvent(new CustomEvent('loadmore', {"target":{}}));

        return flushPromises().then(() => {
            expect(getProductsData).toHaveBeenCalledTimes(2);
            //expect(getProductsData).toHaveBeenCalledWith({"offset": 0, "orderId": "801090000002Qd1AAE"});
            //expect(getProductsData).toHaveBeenCalledWith({"offset": 3, "orderId": "801090000002Qd1AAE"});
        });

    });


    it('Test Lightning Message Channel Subscribe method is called', () => {
        // Test if component subscribed after connected to the DOM
        expect(subscribe).toHaveBeenCalled();
        expect(subscribe.mock.calls[0][1]).toBe(ORDER_MC);
    });


    it('Test if component process message sent through Lightning Message Channel', () => {
        // Select current component.
        const element = document.querySelector('c-available-products');
        
        // Simulate publishing a message to message channel
        const payload = {"TYPE":"Confirmation"};//mockMessageConfirmed;
        publish(
            messageContextWireAdapter,
            ORDER_MC,
            payload
        );

        return flushPromises().then(() => {
            //expect(handleMessage).toHaveBeenCalled();
            // Test if Confirm button was disabled.
            const buttonElement = element.shadowRoot.querySelector('lightning-button');
            expect(buttonElement.disabled).toBe(false);
        });
    });

});