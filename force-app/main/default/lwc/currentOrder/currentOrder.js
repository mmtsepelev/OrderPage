import { LightningElement, wire, api } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import {refreshApex} from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, createMessageContext, releaseMessageContext, subscribe, unsubscribe } from 'lightning/messageService';
import ORDER_MC from '@salesforce/messageChannel/OrderDataChannel__c';
import getOrderItems from '@salesforce/apex/ProductDataProvider.getOrderItems';
import upsertOrderItems from '@salesforce/apex/ProductDataProvider.upsertOrderItems';
import confirmOrder from '@salesforce/apex/HTTPConnector.confirmOrder';



const columns = [
    { label: 'Name', fieldName: 'ProductName', editable: false },
    { label: 'Unit Price', fieldName: 'UnitPrice', editable: false },
    { label: 'Quantity', fieldName: 'Quantity', editable: false },
    { label: 'Total Price', fieldName: 'TotalPrice', editable: false }];

const FIELDS = [
        'Order.Name',
        'Order.OrderNumber',
        'Order.Status',
        'Order.TotalAmount'
    ];

export default class CurrentOrder extends LightningElement {
    @api recordId;
    order;

    context = createMessageContext();
    subscription = null;

    disabled = false;

    columns = columns;
    tableData = [];
    orderItems;

    totalAmount;

    @wire(getRecord,{ recordId : '$recordId', fields : FIELDS })
    wiredOrder ({ error, data }) {
        if (data) {
            this.order = data;
            if(data.fields.Status.value === 'Activated'){
                this.disabled = true;
            }else{
                this.disabled = false;
            }
        } else if (error) {
            this.error = error;
            this.showErrorToast(error);
        }
    }

    get name() {
        return this.order.data.fields.Name.value;
    }

    get number() {
        return this.order.data.fields.OrderNumber.value;
    }

    get status() {
        return this.order.data.fields.Status.value;
    }

    get amount() {
        return this.order.data.fields.TotalAmount.value;
    }

    
    connectedCallback(){
        // Subscribe to LMS messages channel
        this.subscribeMC();
        // Read existing OrderItems
        getOrderItems( { OrderId : this.recordId } )
        .then(data => {
            if(Array.isArray(data)){
                data.forEach(item => {
                    item.ProductName = item.Product2.Name;
                });
                this.tableData = data;
                // Refresh Order record after DML was made in Apex call
                refreshApex(this.order);
            }
        })
        .catch(error => {
            this.showErrorToast(error);
        });
    }

    subscribeMC() {
        if(this.subscription) {
            return;
        }
        this.subscription = subscribe(this.context, ORDER_MC, (message) => {
            //this.handleAddProduct(message);
            this.handleMessage(message);
        });
    }


    unsubscribeMC() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }

    disconnectedCallback() {
        releaseMessageContext(this.context);
    }

    handleMessage(message){
        if(message.TYPE === 'OrderItems' ){
            this.handleAddProduct(message.Array);
        }else if(message.TYPE === 'Confirmation'){
            this.disabled = true;
            refreshApex(this.order);
        }
    }

    handleAddProduct(selection) {
        console.log('handleAddProduct', selection);
        let selectionJSON = JSON.stringify(selection);
        /** Pass selected Products array to Apex method for further processing to be done on server side
         * so calculation of Order items quantity and amount is done in Apex along with records update\insert.
         * Return result is updated ProductItems list contains actual values to be show in table. */
        upsertOrderItems({ OrderId : this.recordId, selectionJSON : selectionJSON })
            .then(data => {
                console.log('upsertOrderItems callback', data);
                if(Array.isArray(data)){
                    data.forEach(item => {
                        item.ProductName = item.Product2.Name;
                    });
                    this.tableData = data;
                    /** Refresh Order record after DML was made in Apex call */
                    refreshApex(this.order);
                }           
            })
            .catch(error => {
                this.showErrorToast(error);
            });
    }


    handleConfirmOrder(event){
        confirmOrder( {orderId : this.recordId} )
            .then(data => {
                console.log('Server call made',data);
                // TODO: Disable editing of Order if request was successful and Status was set to Active by Apex controller.
                refreshApex(this.order);
                const message = {'TYPE' : 'Confirmation'};;
                publish(this.context, ORDER_MC, message);
            })
            .catch(error => {
                this.showErrorToast(error);
            });
    }

    showErrorToast(error) {
        console.log('Error',error);
        const evt = new ShowToastEvent({
            title: 'Server Error',
            message: error.body.message,
            variant: 'error',
        });
        this.dispatchEvent(evt);
    }

}