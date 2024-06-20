import { Client } from '@elastic/elasticsearch';
type ElasticsearchStoreOptions = {
    debug: boolean;
    map?: any;
    index: {
        prefix: string;
        suffix: string;
        map: Record<string, string>;
        exact: string;
    };
    field: {
        zone: {
            name: string;
        };
        base: {
            name: string;
        };
        name: {
            name: string;
        };
        vector: {
            name: string;
        };
    };
    cmd: {
        list: {
            size: number;
        };
    };
    elasticsearch: {
        node: string;
    };
};
declare function ElasticsearchStore(this: any, options: ElasticsearchStoreOptions): {
    name: string;
    exportmap: {
        native: () => {
            client: Client;
        };
    };
};
export default ElasticsearchStore;
