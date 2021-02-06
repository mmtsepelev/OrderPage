/* This component shows current Order Products and submits them to external system by HTTP request.
* Added Products data is passed by a message from AvailableProducts component through Lightning Message Channel.
* Newly added Product record is inserted as related OrderItem and existing Product records is updated by Apex method
* which recalculates Products quantity and total price on server side. Result are passed back to the component so the 
* table updates data immediately.
*/
import { LightningElement, wire, api } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import {refreshApex} from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, createMessageContext, releaseMessageContext, subscribe, unsubscribe } from 'lightning/messageService';
import MESSAGE_CHANNEL from '@salesforce/messageChannel/OrderDataChannel__c';

/* Apex method imports. */
import getOrderItems from '@salesforce/apex/ProductDataProvider.getOrderItems';
import upsertOrderItems from '@salesforce/apex/ProductDataProvider.upsertOrderItems';
import confirmOrder from '@salesforce/apex/HTTPConnector.confirmOrder';


/* Component name for debug messages. */
const COMPONENT = '[CURRENT ORDER]';

/* Table columns definitons. */
const columns = [
    { label: 'Name', fieldName: 'ProductName', editable: false },
    { label: 'Unit Price', fieldName: 'UnitPrice', editable: false },
    { label: 'Quantity', fieldName: 'Quantity', editable: false },
    { label: 'Total Price', fieldName: 'TotalPrice', editable: false }];

/* Order fields to be read by LDS @wire service. */ 
const FIELDS = [
        'Order.Name',
        'Order.OrderNumber',
        'Order.Status',
        'Order.TotalAmount'
    ];

export default class CurrentOrder extends LightningElement {
    /* Properties holds current Record Id and response from @wire LDS service with updated Order record data. */
    @api recordId;
    getRecordResponse;

    /* Properties holds Lightning Message Service data. */
    context = createMessageContext();
    subscription = null;

    /* Property holds Confirm button state. */
    disabled = false;

    /* Properties hold table columns definitions and rows data. */
    columns = columns;
    tableData = [];
    
    /* Order total amount value. Updated by Apex calls since caching it by LDS 
    * does not provide actual values from the database. */
    totalAmount;

    /* Read current Order fields. */
    @wire(getRecord,{ recordId : '$recordId', fields : FIELDS })
    wiredOrder(response) {
        this.getRecordResponse = response;
        let error = response && response.error;
        let data = response && response.data;
        if(data){
            console.log(COMPONENT+ ' @wire data',data);
            /* Update Order status. */
            if(data.fields.Status.value === 'Activated'){
                this.disabled = true;
            }else{
                this.disabled = false;
            }
        } else if(error){
            this.showErrorToast(error);
        }
    }
    
    connectedCallback(){
        /* Subscribe to LMS messages channel to get Order updates from AvailableProducts component. */
        this.subscribe();
        /* Read existing OrderItems from database. */
        getOrderItems( { OrderId : this.recordId } )
        .then(data => {
            if(Array.isArray(data)){
                console.log(COMPONENT+' Apex getOrderItems()',data);
                data.forEach(item => {
                    item.ProductName = item.Product2.Name;
                    this.totalAmount = item.Order.TotalAmount;
                });
                this.tableData = data;
            }
        })
        .catch(error => {
            this.showErrorToast(error);
        });
    }

    /* Generic message channel subscription methods. */
    subscribe() {
        if(this.subscription) {
            return;
        }
        this.subscription = subscribe(this.context, MESSAGE_CHANNEL, (message) => {
            this.handleMessage(message);
        });
    }


    unsubscribe() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }


    disconnectedCallback() {
        releaseMessageContext(this.context);
    }

    /* Handle message with Product data selected in AvailableProducts component to be added to the Order. 
    * Handle Confirmation message. */  
    handleMessage(message){
        console.log(COMPONENT +' handleMessage()', message);
        if(message.TYPE === 'OrderItems' ){
            this.handleAddProduct(message.Array);
        }else if(message.TYPE === 'Confirmation'){
            this.disabled = true;

            /* Refresh record data. */
            refreshApex(this.getRecordResponse);
        }
    }

    handleAddProduct(selection) {
        let selectionJSON = JSON.stringify(selection);
        /** Pass selected Products array to Apex method for further processing to be done on server side
         * so calculation of Order items quantity and amount is done in Apex along with records update\insert.
         * Return result is updated ProductItems list containing actual values to be shown in the table. */
        upsertOrderItems({ OrderId : this.recordId, selectionJSON : selectionJSON })
            .then(data => {
                console.log(COMPONENT+' Apex upsertOrderItems()', data);
                if(Array.isArray(data)){
                    data.forEach(item => {
                        item.ProductName = item.Product2.Name;
                        this.totalAmount = item.Order.TotalAmount;
                    });
                    this.tableData = data;
                }           
            })
            .catch(error => {
                this.showErrorToast(error);
            });

            /* Refresh record data after Apex call. */
            refreshApex(this.getRecordResponse);
    }

    /* Confirm Order in external system. HTTP request will be sent by Apex method. */
    handleConfirmOrder(event){
        confirmOrder( {orderId : this.recordId} )
            .then(data => {
                console.log(COMPONENT+' Apex confirmOrder()', data);
                if(data === 200){
                    /* Publish confimation message for AvailableProducts component to disable adding new items to current Order.
                    * Also current component will handle this message to switch Confirm button state to disabled. */
                    const message = {'TYPE' : 'Confirmation'};;
                    publish(this.context, MESSAGE_CHANNEL, message);
                }
            })
            .catch(error => {
                this.showErrorToast(error);
            });
    }


    /* Show error toast with defined message on error. */
    showErrorToast(error) {
        console.log(COMPONENT+' Error', JSON.stringify(error));
        const evt = new ShowToastEvent({
            title: 'Server Error',
            message: error.body.message,
            variant: 'error',
        });
        this.dispatchEvent(evt);
    }

}