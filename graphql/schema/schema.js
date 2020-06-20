import { gql } from 'apollo-server-express';

import UserSchema from './User';

const schema = gql`
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  ${UserSchema}
`;

export default schema;
